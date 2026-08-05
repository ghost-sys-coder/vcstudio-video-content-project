import "server-only";
import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  MARKETING_RESEARCH_PROMPT_VERSION,
  renderMarketingResearchPrompt,
} from "@studio/prompts";
import {
  completeResearchSnapshot,
  createPendingResearchSnapshot,
  failResearchSnapshot,
  markCompetitorResearched,
  markResearchSnapshotRunning,
} from "@/db/commands/marketing-research-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
  setMarketingRunPrompt,
} from "@/db/commands/marketing-usage-commands";
import type { MarketingCompetitor } from "@/db/schema";
import { estimateMarketingTextCost } from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { compileBrandContext } from "@/lib/marketing/brand/compile-brand-context";
import { createResearchProvider } from "@/lib/marketing/research/research-provider-registry";
import type { ResearchResponse } from "@/lib/marketing/research/research-provider";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { researchSnapshotDocumentSchema } from "@/lib/schemas/marketing-research";

export async function runMarketingResearch(input: {
  workspaceId: string;
  requestedByUserId: string;
  kind: "competitor" | "trend";
  topic: string;
  competitor?: MarketingCompetitor;
  campaignContext?: string;
  idempotencySubject: string;
}) {
  const environment = getMarketingEnvironment();
  const provider = createResearchProvider();
  const queries = (
    input.competitor
      ? [
          `${input.competitor.name} ${input.competitor.websiteUrl ?? ""} products positioning offers`,
          `${input.competitor.name} latest news announcements marketing`,
        ]
      : [`${input.topic} current trends news marketing`]
  ).slice(0, environment.MARKETING_RESEARCH_MAX_QUERIES);
  const brandContext = await compileBrandContext({
    workspaceId: input.workspaceId,
  });
  const reservationPrompt = renderMarketingResearchPrompt({
    subject: input.competitor?.name ?? input.topic,
    brandContext: brandContext.text,
    campaignContext: input.campaignContext,
    sources: [],
  });
  const estimate = estimateMarketingTextCost({
    prompt: `${reservationPrompt}\n${"x".repeat(24_000)}`,
    expectedOutputTokens: 2_000,
    rates: {
      inputCostPerMillionCents:
        environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
    },
  });
  const hashes = getSceneAnalysisEnvironment();
  const reservation = await reserveMarketingUsage({
    workspaceId: input.workspaceId,
    operation:
      input.kind === "competitor" ? "competitor_analysis" : "trend_scan",
    estimatedCostCents: estimate,
    idempotencyKey: createMarketingOperationIdempotencyKey({
      secret: hashes.IDEMPOTENCY_HASH_SECRET,
      workspaceId: input.workspaceId,
      operation:
        input.kind === "competitor" ? "competitor_analysis" : "trend_scan",
      subjectId: input.idempotencySubject,
      subjectFingerprint: createHash("sha256")
        .update(queries.join("\n"))
        .digest("hex"),
      model: environment.MARKETING_CHAT_MODEL,
      promptVersion: MARKETING_RESEARCH_PROMPT_VERSION,
    }),
    requestedByUserId: input.requestedByUserId,
    model: environment.MARKETING_CHAT_MODEL,
    promptVersion: MARKETING_RESEARCH_PROMPT_VERSION,
    finalPrompt: reservationPrompt,
    requestFingerprint: createRequestFingerprint(
      hashes.REQUEST_FINGERPRINT_SECRET,
      reservationPrompt,
    ),
    subjectKind: "research_snapshot",
    subjectId: input.idempotencySubject,
  });
  const snapshotId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + environment.MARKETING_RESEARCH_FRESHNESS_DAYS * 86_400_000,
  );
  await createPendingResearchSnapshot({
    id: snapshotId,
    workspaceId: input.workspaceId,
    kind: input.kind,
    competitorId: input.competitor?.id ?? null,
    topic: input.topic,
    queries,
    provider: provider.name,
    freshnessWindowDays: environment.MARKETING_RESEARCH_FRESHNESS_DAYS,
    expiresAt,
    runId: reservation.runId,
  });
  await markMarketingRunRunning({
    workspaceId: input.workspaceId,
    runId: reservation.runId,
    attemptCount: 1,
  });
  await markResearchSnapshotRunning({
    workspaceId: input.workspaceId,
    id: snapshotId,
  });
  try {
    const responses: ResearchResponse[] = [];
    for (const [index, query] of queries.entries())
      responses.push(
        await provider.search({
          query,
          maxResults: 8,
          recencyDays: index === 0 && input.competitor ? null : 30,
          includeDomains:
            index === 0 && input.competitor?.websiteUrl
              ? [new URL(input.competitor.websiteUrl).hostname]
              : [],
          excludeDomains: [],
        }),
      );
    const uniqueResults = [
      ...new Map(
        responses
          .flatMap((response) => response.results)
          .map((result) => [result.url, result]),
      ).values(),
    ].slice(0, 16);
    if (uniqueResults.length === 0)
      throw new Error("MARKETING_RESEARCH_NO_RESULTS");
    const citations = uniqueResults.map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      publishedAt: result.publishedAt?.toISOString() ?? null,
    }));
    const prompt = renderMarketingResearchPrompt({
      subject: input.competitor?.name ?? input.topic,
      brandContext: brandContext.text,
      campaignContext: input.campaignContext,
      sources: citations.map((citation, index) => ({ index, ...citation })),
    });
    await setMarketingRunPrompt({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      finalPrompt: prompt,
      requestFingerprint: createRequestFingerprint(
        hashes.REQUEST_FINGERPRINT_SECRET,
        prompt,
      ),
    });
    const result = await generateObject({
      model: openai(environment.MARKETING_CHAT_MODEL),
      schema: researchSnapshotDocumentSchema,
      prompt,
    });
    const validated = researchSnapshotDocumentSchema.parse(result.object);
    for (const item of [
      ...validated.findings,
      ...validated.opportunities,
      ...validated.risks,
      ...validated.contentAngles,
    ]) {
      if (item.sourceIndexes.some((index) => index >= citations.length))
        throw new Error("MARKETING_RESEARCH_INVALID_CITATION");
    }
    const actualCostCents = Math.max(
      0,
      Math.ceil(
        ((result.usage.inputTokens ?? 0) *
          environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS +
          (result.usage.outputTokens ?? 0) *
            environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS) /
          1_000_000,
      ),
    );
    await completeResearchSnapshot({
      workspaceId: input.workspaceId,
      id: snapshotId,
      providerRequestId:
        responses
          .map((response) => response.requestId)
          .filter(Boolean)
          .join(",") || null,
      resultDocument: validated,
      citations,
      resultHash: createHash("sha256")
        .update(JSON.stringify(validated))
        .digest("hex"),
    });
    await reconcileMarketingUsage({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation:
        input.kind === "competitor" ? "competitor_analysis" : "trend_scan",
      actualCostCents,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      providerRequestId: result.response.id,
      safeMetadata: { snapshotId, provider: provider.name },
    });
    if (input.competitor)
      await markCompetitorResearched({
        workspaceId: input.workspaceId,
        competitorId: input.competitor.id,
      });
    return { snapshotId, document: validated, citations };
  } catch (error) {
    await failResearchSnapshot({
      workspaceId: input.workspaceId,
      id: snapshotId,
      category: "research_failed",
      message: "Current research could not be validated.",
    });
    await failMarketingRun({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation:
        input.kind === "competitor" ? "competitor_analysis" : "trend_scan",
      category: "research_failed",
      message: "Current research could not be validated.",
      chargedCostCents: estimate,
    });
    throw error;
  }
}
