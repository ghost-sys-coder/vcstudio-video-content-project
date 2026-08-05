import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk";
import { generateObject } from "ai";
import { z } from "zod";
import {
  MARKETING_SCHEDULE_PROMPT_VERSION,
  renderMarketingSchedulePrompt,
} from "@studio/prompts";
import {
  completeMarketingScheduleRun,
  failMarketingScheduleRun,
  skipMarketingScheduleRun,
} from "@/db/commands/marketing-schedule-commands";
import {
  attachMediaToMarketingContent,
  createMarketingContentItem,
  failMarketingContentItem,
} from "@/db/commands/marketing-content-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import {
  countGeneratedMarketingItemsSince,
  findMarketingScheduleRun,
  getScheduleRuleCommittedSpend,
} from "@/db/repositories/marketing-schedules.repository";
import { listMarketingResearchSnapshots } from "@/db/repositories/marketing-research.repository";
import { listMediaAssets } from "@/db/repositories/media-assets.repository";
import { estimateMarketingTextCost } from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import { MarketingBudgetExceededError } from "@/lib/domain/errors";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { compileBrandContext } from "@/lib/marketing/brand/compile-brand-context";
import {
  estimateMarketingGraphicCostCents,
  generateCampaignGraphic,
} from "@/lib/marketing/campaigns/generate-campaign-graphic";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import { evaluateScheduleCaps } from "@/lib/marketing/schedules/schedule-caps";
import {
  getStartOfZonedDay,
  getStartOfZonedMonth,
} from "@/lib/marketing/schedules/recurrence";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { marketingScheduleGenerationSchema } from "@/lib/schemas/marketing-schedule-generation";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";

const payloadSchema = z.object({
  workspaceId: z.uuid(),
  scheduleRunId: z.uuid(),
});

export const marketingScheduleGenerationTask = task({
  id: "marketing-schedule-generation",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: { maxAttempts: 1 },
  maxDuration: 900,
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const input = payloadSchema.parse(payload);
    const scheduled = await findMarketingScheduleRun(input);
    if (!scheduled) throw new Error("Marketing schedule run not found.");
    if (["succeeded", "failed", "skipped"].includes(scheduled.run.status))
      return { status: scheduled.run.status };

    const now = new Date();
    let reservation: {
      runId: string;
      reservationId: string;
      estimatedCostCents: number;
    } | null = null;
    let providerStarted = false;
    let reconciled = false;
    try {
      const settings = await loadMarketingSettings({
        workspaceId: input.workspaceId,
      });
      const [brand, snapshots, media, generatedToday] = await Promise.all([
        compileBrandContext({ workspaceId: input.workspaceId }),
        listMarketingResearchSnapshots({ workspaceId: input.workspaceId }),
        listMediaAssets({ workspaceId: input.workspaceId, limit: 60 }),
        countGeneratedMarketingItemsSince({
          workspaceId: input.workspaceId,
          since: getStartOfZonedDay(now, settings.defaultTimezone),
        }),
      ]);
      const freshResearch = snapshots
        .filter(
          (snapshot) =>
            snapshot.status === "succeeded" &&
            snapshot.expiresAt.getTime() > now.getTime() &&
            snapshot.resultDocument,
        )
        .slice(0, 8);
      const prompt = renderMarketingSchedulePrompt({
        brief: scheduled.rule.promptBrief,
        skillKey: scheduled.rule.skillKey,
        contentKind: scheduled.rule.contentKind,
        trafficType: scheduled.rule.trafficType,
        platforms: scheduled.rule.platforms,
        itemCount: scheduled.rule.maxItemsPerRun,
        publishAt: scheduled.run.scheduledFor.toISOString(),
        brandContext: scheduled.rule.isBranded
          ? brand.text
          : "Create neutral, unbranded editorial content. Do not use brand names, offers, slogans, or visual identity.",
        researchContext: freshResearch
          .map((snapshot) =>
            JSON.stringify({
              snapshotId: snapshot.id,
              topic: snapshot.topic,
              result: snapshot.resultDocument,
            }),
          )
          .join("\n"),
        mediaContext: media
          .map((asset) =>
            JSON.stringify({
              id: asset.id,
              kind: asset.kind,
              title: asset.title || asset.originalFileName,
              altText: asset.altText,
              tags: asset.tags,
              width: asset.width,
              height: asset.height,
              durationMilliseconds: asset.durationMilliseconds,
            }),
          )
          .join("\n"),
      });
      const environment = getMarketingEnvironment();
      const hashes = getSceneAnalysisEnvironment();
      const estimatedCostCents = estimateMarketingTextCost({
        prompt,
        expectedOutputTokens: 1_500 * scheduled.rule.maxItemsPerRun,
        rates: {
          inputCostPerMillionCents:
            environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
          outputCostPerMillionCents:
            environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
        },
      });
      const estimatedMediaCostCents =
        scheduled.rule.contentKind === "graphic"
          ? scheduled.rule.maxItemsPerRun *
            Math.max(
              ...scheduled.rule.platforms.map((platform) =>
                estimateMarketingGraphicCostCents({
                  platform,
                  prompt: `${scheduled.rule.promptBrief}\nCreate a polished social graphic without rendering logos or text unless explicitly requested.`,
                }),
              ),
            )
          : 0;
      const ruleSpend = await getScheduleRuleCommittedSpend({
        workspaceId: input.workspaceId,
        ruleId: scheduled.rule.id,
        since: getStartOfZonedMonth(now, scheduled.rule.timezone),
      });
      const cap = evaluateScheduleCaps({
        itemsGeneratedToday: generatedToday,
        requestedItems: scheduled.rule.maxItemsPerRun,
        dailyItemCap: settings.dailyMaxGeneratedItems,
        ruleCommittedCents: ruleSpend,
        estimatedCostCents: estimatedCostCents + estimatedMediaCostCents,
        monthlyRuleBudgetCents: scheduled.rule.monthlyBudgetCents,
      });
      if (!cap.allowed) {
        await skipMarketingScheduleRun({
          workspaceId: input.workspaceId,
          scheduleRunId: scheduled.run.id,
          ruleId: scheduled.rule.id,
          reason: cap.reason,
        });
        return { status: "skipped" as const, reason: cap.reason };
      }

      const reserved = await reserveMarketingUsage({
        workspaceId: input.workspaceId,
        operation: "content_draft",
        estimatedCostCents,
        idempotencyKey: createMarketingOperationIdempotencyKey({
          secret: hashes.IDEMPOTENCY_HASH_SECRET,
          workspaceId: input.workspaceId,
          operation: "content_draft",
          subjectId: scheduled.run.id,
          subjectFingerprint: createHash("sha256").update(prompt).digest("hex"),
          model: environment.MARKETING_CHAT_MODEL,
          promptVersion: MARKETING_SCHEDULE_PROMPT_VERSION,
        }),
        requestedByUserId: scheduled.rule.createdByUserId,
        model: environment.MARKETING_CHAT_MODEL,
        promptVersion: MARKETING_SCHEDULE_PROMPT_VERSION,
        finalPrompt: prompt,
        requestFingerprint: createRequestFingerprint(
          hashes.REQUEST_FINGERPRINT_SECRET,
          prompt,
        ),
        subjectKind: "schedule_rule",
        subjectId: scheduled.rule.id,
      });
      reservation = { ...reserved, estimatedCostCents };
      await markMarketingRunRunning({
        workspaceId: input.workspaceId,
        runId: reserved.runId,
        attemptCount: 1,
      });
      providerStarted = true;
      const generated = await generateObject({
        model: openai(environment.MARKETING_CHAT_MODEL),
        schema: marketingScheduleGenerationSchema,
        prompt,
      });
      const researchIds = new Set(freshResearch.map((snapshot) => snapshot.id));
      const mediaIds = new Set(media.map((asset) => asset.id));
      const plan = marketingScheduleGenerationSchema.parse(generated.object);
      const items = plan.items
        .filter((item) => scheduled.rule.platforms.includes(item.platform))
        .slice(0, scheduled.rule.maxItemsPerRun);
      if (items.length !== scheduled.rule.maxItemsPerRun)
        throw new Error("SCHEDULE_OUTPUT_INCOMPLETE");
      const contentItemIds: string[] = [];
      let mediaFailureCount = 0;
      for (const planned of items) {
        if (
          planned.researchSnapshotIds.some((id) => !researchIds.has(id)) ||
          (planned.mediaAssetId && !mediaIds.has(planned.mediaAssetId))
        )
          throw new Error("SCHEDULE_OUTPUT_UNKNOWN_CONTEXT");
        const item = await createMarketingContentItem({
          workspaceId: input.workspaceId,
          campaignId: scheduled.rule.campaignId,
          kind: scheduled.rule.contentKind,
          platform: planned.platform,
          title: planned.title,
          bodyDocument: plainTextToPortableDocument(planned.body),
          bodyPlainText: planned.body,
          sourceRunId: reserved.runId,
          createdByUserId: scheduled.rule.createdByUserId,
          trafficType: scheduled.rule.trafficType,
          isBranded: scheduled.rule.isBranded,
          scheduledFor: scheduled.run.scheduledFor,
          structuredPayload: {
            scheduleRuleId: scheduled.rule.id,
            scheduleRunId: scheduled.run.id,
            visualDirection: planned.visualDirection,
            researchSnapshotIds: planned.researchSnapshotIds,
            researchRationale: planned.researchRationale,
          },
        });
        contentItemIds.push(item.id);
        try {
          if (planned.mediaAssetId)
            await attachMediaToMarketingContent({
              workspaceId: input.workspaceId,
              contentItemId: item.id,
              mediaAssetId: planned.mediaAssetId,
            });
          else if (scheduled.rule.contentKind === "graphic")
            await generateCampaignGraphic({
              workspaceId: input.workspaceId,
              campaignId: scheduled.rule.campaignId,
              contentItemId: item.id,
              platform: planned.platform,
              title: planned.title,
              prompt: `${planned.visualDirection}\n${scheduled.rule.promptBrief}\nCreate a polished social graphic without rendering logos or text unless explicitly requested.`,
              requestedByUserId: scheduled.rule.createdByUserId,
              usageSubject: { kind: "schedule_rule", id: scheduled.rule.id },
            });
        } catch {
          mediaFailureCount += 1;
          await failMarketingContentItem({
            workspaceId: input.workspaceId,
            contentItemId: item.id,
            category: "scheduled_media_generation_failed",
            message:
              "The scheduled draft was created, but its media could not be prepared.",
          });
        }
      }
      const actualCostCents = Math.max(
        0,
        Math.ceil(
          ((generated.usage.inputTokens ?? 0) *
            environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS +
            (generated.usage.outputTokens ?? 0) *
              environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS) /
            1_000_000,
        ),
      );
      await reconcileMarketingUsage({
        workspaceId: input.workspaceId,
        runId: reserved.runId,
        reservationId: reserved.reservationId,
        operation: "content_draft",
        actualCostCents,
        inputTokens: generated.usage.inputTokens ?? 0,
        outputTokens: generated.usage.outputTokens ?? 0,
        providerRequestId: generated.response.id,
        safeMetadata: {
          scheduleRuleId: scheduled.rule.id,
          scheduleRunId: scheduled.run.id,
          generatedItems: contentItemIds.length,
        },
      });
      reconciled = true;
      if (mediaFailureCount > 0) {
        await failMarketingScheduleRun({
          workspaceId: input.workspaceId,
          scheduleRunId: scheduled.run.id,
          ruleId: scheduled.rule.id,
          runId: reserved.runId,
          category: "scheduled_media_generation_failed",
          message: `${mediaFailureCount} scheduled draft(s) could not prepare their media.`,
        });
        return { status: "failed" as const, contentItemIds };
      }
      await completeMarketingScheduleRun({
        workspaceId: input.workspaceId,
        scheduleRunId: scheduled.run.id,
        ruleId: scheduled.rule.id,
        runId: reserved.runId,
        contentItemIds,
      });
      return { status: "succeeded" as const, contentItemIds };
    } catch (error) {
      if (error instanceof MarketingBudgetExceededError) {
        await skipMarketingScheduleRun({
          workspaceId: input.workspaceId,
          scheduleRunId: scheduled.run.id,
          ruleId: scheduled.rule.id,
          reason: "budget_exhausted",
        });
        return { status: "skipped" as const, reason: "budget_exhausted" };
      }
      const failure = classifyMarketingProviderError(error);
      const charged =
        reservation && providerStarted ? reservation.estimatedCostCents : 0;
      if (reservation && !reconciled)
        await failMarketingRun({
          workspaceId: input.workspaceId,
          runId: reservation.runId,
          reservationId: reservation.reservationId,
          operation: "content_draft",
          category: failure.category,
          message: "Scheduled content generation failed.",
          chargedCostCents: charged,
        });
      await failMarketingScheduleRun({
        workspaceId: input.workspaceId,
        scheduleRunId: scheduled.run.id,
        ruleId: scheduled.rule.id,
        runId: reservation?.runId,
        category: failure.category,
        message: "Scheduled content generation failed.",
      });
      return { status: "failed" as const };
    }
  },
});
