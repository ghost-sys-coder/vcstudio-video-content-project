import "server-only";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  renderMarketingSkillPrompt,
  renderOrganicCampaignPrompt,
  renderPaidCampaignPrompt,
} from "@studio/prompts";
import {
  createMarketingCampaign,
  updateCampaignAutomationState,
} from "@/db/commands/marketing-campaign-commands";
import {
  attachMarketingToolCallRun,
  beginMarketingToolCall,
  completeMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import { estimateMarketingTextCost } from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import type {
  MarketingSkillDefinition,
  SkillExecutionContext,
} from "@/lib/marketing/skills/skill-definition";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { createMarketingContentItem } from "@/db/commands/marketing-content-commands";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import type { ContentPlatform, MarketingContentKind } from "@/db/schema";
import { marketingCampaignMutationSchema } from "@/lib/schemas/marketing-campaign";
import { dispatchCampaignAutomation } from "@/lib/marketing/campaigns/dispatch-campaign-automation";

const CONTENT_KIND_BY_SKILL = {
  create_social_post: "social_post",
  write_email: "email",
  write_blog_post: "blog_post",
  create_newsletter: "newsletter",
  create_media_story: "media_story",
} as const satisfies Partial<Record<string, MarketingContentKind>>;

export async function executeInlineMarketingSkill(input: {
  definition: MarketingSkillDefinition;
  values: Record<string, string | number>;
  toolCallId: string;
  context: SkillExecutionContext;
}): Promise<{
  text: string;
  skillKey: string;
  contentItemId?: string;
  campaignId?: string;
}> {
  const { definition, context } = input;
  requireCapability(context.role, definition.capability);
  if (
    definition.billing.kind !== "text" ||
    !definition.operation ||
    !definition.rateLimitOperation
  )
    throw new Error("MARKETING_SKILL_NOT_BILLABLE_TEXT");
  await enforceRateLimit({
    workspaceId: context.workspaceId,
    operation: definition.rateLimitOperation,
  });
  const environment = getMarketingEnvironment();
  const hashEnvironment = getSceneAnalysisEnvironment();
  const campaignPromptInput = {
    name: String(input.values.name ?? ""),
    objective: String(input.values.objective ?? ""),
    platform: String(input.values.platform ?? ""),
    keyMessage: String(input.values.keyMessage ?? ""),
    audience: String(input.values.audience ?? ""),
    brandContext: context.brandContext,
  };
  const prompt =
    definition.key === "create_campaign"
      ? input.values.trafficType === "organic"
        ? renderOrganicCampaignPrompt(campaignPromptInput)
        : renderPaidCampaignPrompt(campaignPromptInput)
      : renderMarketingSkillPrompt({
          skillLabel: definition.label,
          instructions: definition.instructions,
          inputs: input.values,
          brandContext: context.brandContext,
        });
  const estimatedCostCents = estimateMarketingTextCost({
    prompt,
    expectedOutputTokens: definition.billing.expectedOutputTokens,
    rates: {
      inputCostPerMillionCents:
        environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
    },
  });
  const toolRow = await beginMarketingToolCall({
    workspaceId: context.workspaceId,
    threadId: context.threadId,
    messageId: context.messageId,
    toolCallId: input.toolCallId,
    skillKey: definition.key,
    toolInput: input.values,
    estimatedCostCents,
  });
  if (
    toolRow.status === "succeeded" &&
    toolRow.output &&
    typeof toolRow.output.text === "string"
  )
    return {
      text: toolRow.output.text,
      skillKey: definition.key,
      contentItemId:
        typeof toolRow.output.contentItemId === "string"
          ? toolRow.output.contentItemId
          : undefined,
      campaignId:
        typeof toolRow.output.campaignId === "string"
          ? toolRow.output.campaignId
          : undefined,
    };
  if (toolRow.runId) throw new Error("MARKETING_TOOL_CALL_ALREADY_RUNNING");
  let reservation;
  try {
    reservation = await reserveMarketingUsage({
      workspaceId: context.workspaceId,
      operation: definition.operation,
      estimatedCostCents,
      idempotencyKey: createMarketingOperationIdempotencyKey({
        secret: hashEnvironment.IDEMPOTENCY_HASH_SECRET,
        workspaceId: context.workspaceId,
        operation: definition.operation,
        subjectId: toolRow.id,
        subjectFingerprint: context.brandContextFingerprint,
        model: environment.MARKETING_CHAT_MODEL,
        promptVersion: definition.promptVersion,
      }),
      requestedByUserId: context.userId,
      model: environment.MARKETING_CHAT_MODEL,
      promptVersion: definition.promptVersion,
      finalPrompt: prompt,
      requestFingerprint: createRequestFingerprint(
        hashEnvironment.REQUEST_FINGERPRINT_SECRET,
        prompt,
      ),
      subjectKind: "chat_tool_call",
      subjectId: toolRow.id,
    });
  } catch (error) {
    await failMarketingToolCall({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      category: "reservation_refused",
      message: "This skill could not start because its cost was not approved.",
      actualCostCents: 0,
    });
    throw error;
  }
  await attachMarketingToolCallRun({
    workspaceId: context.workspaceId,
    id: toolRow.id,
    runId: reservation.runId,
  });
  await markMarketingRunRunning({
    workspaceId: context.workspaceId,
    runId: reservation.runId,
    attemptCount: 1,
  });
  let knownProviderCostCents: number | null = null;
  try {
    const result = await generateText({
      model: openai(environment.MARKETING_CHAT_MODEL),
      instructions:
        "Complete the requested marketing task faithfully. Return usable copy, not commentary about the task.",
      prompt,
    });
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
    knownProviderCostCents = actualCostCents;
    const contentKind =
      CONTENT_KIND_BY_SKILL[
        definition.key as keyof typeof CONTENT_KIND_BY_SKILL
      ];
    let contentItemId: string | undefined;
    let campaignId: string | undefined;
    if (definition.key === "create_campaign") {
      const campaignInput = marketingCampaignMutationSchema.parse({
        name: input.values.name,
        objective: input.values.objective,
        trafficType: input.values.trafficType,
        status: "draft",
        startDate: new Date().toISOString().slice(0, 10),
        platforms: [input.values.platform],
        keyMessage: input.values.keyMessage,
        hypothesis: `If we communicate ${String(input.values.keyMessage)}, the campaign will improve ${String(input.values.objective)} among ${String(input.values.audience)}.`,
        briefPlainText: result.text,
        isBranded: true,
      });
      const campaign = await createMarketingCampaign({
        ...campaignInput,
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
      });
      campaignId = campaign.id;
      try {
        await dispatchCampaignAutomation({
          workspaceId: context.workspaceId,
          campaignId: campaign.id,
          requestedByUserId: context.userId,
        });
      } catch {
        await updateCampaignAutomationState({
          workspaceId: context.workspaceId,
          campaignId: campaign.id,
          status: "failed",
          error: "Campaign automation could not be queued. Try again.",
        });
      }
      if (campaign.trafficType !== "organic") {
        for (const [index, variantLabel] of ["A", "B", "C"].entries()) {
          const headline = String(input.values.keyMessage).slice(0, 80);
          const primaryText = `${String(input.values.audience)}: ${String(input.values.keyMessage)} ${index === 0 ? "Learn what changes next." : index === 1 ? "See the practical difference." : "Explore a clearer path forward."}`;
          await createMarketingContentItem({
            workspaceId: context.workspaceId,
            campaignId: campaign.id,
            kind: "ad_creative",
            platform: campaign.platforms[0] ?? null,
            trafficType: "paid",
            title: `${campaign.name} · Variant ${variantLabel}`,
            bodyDocument: plainTextToPortableDocument(primaryText),
            bodyPlainText: primaryText,
            structuredPayload: {
              headline,
              primaryText,
              description: "Campaign creative for review and export.",
              cta: campaign.objective === "sales" ? "Shop now" : "Learn more",
              platform: campaign.platforms[0],
              placement: "feed",
              variantLabel,
            },
            sourceRunId: reservation.runId,
            createdByUserId: context.userId,
          });
        }
      }
    }
    if (contentKind) {
      const item = await createMarketingContentItem({
        workspaceId: context.workspaceId,
        kind: contentKind,
        platform:
          typeof input.values.platform === "string"
            ? (input.values.platform as ContentPlatform)
            : null,
        title: definition.label,
        bodyDocument: plainTextToPortableDocument(result.text),
        bodyPlainText: result.text,
        sourceRunId: reservation.runId,
        createdByUserId: context.userId,
      });
      contentItemId = item.id;
    }
    await completeMarketingToolCall({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      output: { text: result.text, contentItemId, campaignId },
      actualCostCents,
    });
    await reconcileMarketingUsage({
      workspaceId: context.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation: definition.operation,
      actualCostCents,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      providerRequestId: result.response.id,
      safeMetadata: { threadId: context.threadId, skillKey: definition.key },
    });
    return {
      text: result.text,
      skillKey: definition.key,
      contentItemId,
      campaignId,
    };
  } catch (error) {
    const failure = classifyMarketingProviderError(error);
    const charged =
      knownProviderCostCents ??
      (failure.mayHaveBilled ? estimatedCostCents : 0);
    await failMarketingToolCall({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      category: failure.category,
      message: failure.message,
      actualCostCents: charged,
    });
    await failMarketingRun({
      workspaceId: context.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation: definition.operation,
      category: failure.category,
      message: failure.message,
      chargedCostCents: charged,
    });
    throw error;
  }
}
