import { task } from "@trigger.dev/sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { appendDeferredToolResultMessage } from "@/db/commands/marketing-chat-commands";
import {
  completeMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import { createMarketingContentItem } from "@/db/commands/marketing-content-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import { findMarketingToolCall } from "@/db/repositories/marketing-chat.repository";
import { findMarketingRun } from "@/db/repositories/marketing-usage.repository";
import type { ContentPlatform, MarketingContentKind } from "@/db/schema";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import { MARKETING_SKILL_REGISTRY } from "@/lib/marketing/skills/skill-registry";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";

const payloadSchema = z.object({ workspaceId: z.uuid(), toolCallId: z.uuid() });
const kindBySkill = {
  write_blog_post: "blog_post",
  create_newsletter: "newsletter",
} as const satisfies Record<string, MarketingContentKind>;

export const marketingContentGenerationTask = task({
  id: "marketing-content-generation",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: { maxAttempts: 3, minTimeoutInMs: 2_000, maxTimeoutInMs: 30_000 },
  maxDuration: 300,
  run: async (payload: z.infer<typeof payloadSchema>, { ctx }) => {
    const input = payloadSchema.parse(payload);
    const toolCall = await findMarketingToolCall(input);
    if (!toolCall) throw new Error("Marketing tool call not found.");
    if (["succeeded", "failed", "cancelled"].includes(toolCall.status))
      return { toolCallId: toolCall.id, status: toolCall.status };
    if (!toolCall.runId) throw new Error("Marketing tool call has no run.");
    const ledger = await findMarketingRun({
      workspaceId: input.workspaceId,
      runId: toolCall.runId,
    });
    const definition =
      MARKETING_SKILL_REGISTRY[
        toolCall.skillKey as keyof typeof MARKETING_SKILL_REGISTRY
      ];
    const hashes = getSceneAnalysisEnvironment();
    if (
      !ledger ||
      !definition ||
      definition.billing.kind !== "text" ||
      ledger.reservation.status !== "pending" ||
      ledger.reservation.expiresAt.getTime() < Date.now() ||
      ledger.reservation.reservedCostCents !== toolCall.estimatedCostCents ||
      ledger.run.requestFingerprint !==
        createRequestFingerprint(
          hashes.REQUEST_FINGERPRINT_SECRET,
          ledger.run.finalPrompt,
        )
    ) {
      await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: "preflight_failed",
        message: "This generation expired before it could start.",
        actualCostCents: 0,
      });
      return { toolCallId: toolCall.id, status: "failed" as const };
    }
    await markMarketingRunRunning({
      workspaceId: input.workspaceId,
      runId: ledger.run.id,
      attemptCount: ctx.attempt.number,
    });
    const environment = getMarketingEnvironment();
    try {
      const result = await generateText({
        model: openai(environment.MARKETING_CHAT_MODEL),
        instructions:
          "Return polished usable marketing copy, without meta commentary.",
        prompt: ledger.run.finalPrompt,
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
      const kind = kindBySkill[toolCall.skillKey as keyof typeof kindBySkill];
      if (!kind) throw new Error("Unsupported deferred content skill.");
      const item = await createMarketingContentItem({
        workspaceId: input.workspaceId,
        kind,
        platform:
          typeof toolCall.input.platform === "string"
            ? (toolCall.input.platform as ContentPlatform)
            : null,
        title: definition.label,
        bodyDocument: plainTextToPortableDocument(result.text),
        bodyPlainText: result.text,
        sourceRunId: ledger.run.id,
        createdByUserId: ledger.run.requestedByUserId,
      });
      const completed = await completeMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        output: { text: result.text, contentItemId: item.id },
        actualCostCents,
      });
      await reconcileMarketingUsage({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        actualCostCents,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        providerRequestId: result.response.id,
        safeMetadata: {
          threadId: toolCall.threadId,
          skillKey: toolCall.skillKey,
        },
      });
      if (completed)
        await appendDeferredToolResultMessage({
          workspaceId: input.workspaceId,
          threadId: toolCall.threadId,
          runId: ledger.run.id,
          part: {
            type: "data-toolResult",
            data: {
              skillKey: toolCall.skillKey,
              summary: `${definition.label} is ready for review.`,
              contentItemId: item.id,
            },
          },
          plainText: `${definition.label} is ready for review.`,
          costCents: actualCostCents,
        });
      return { toolCallId: toolCall.id, status: "succeeded" as const };
    } catch (error) {
      const failure = classifyMarketingProviderError(error);
      if (failure.retriable && ctx.attempt.number < (ctx.run.maxAttempts ?? 3))
        throw error;
      const charged = failure.mayHaveBilled
        ? ledger.reservation.reservedCostCents
        : 0;
      const failed = await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: failure.category,
        message: failure.message,
        actualCostCents: charged,
      });
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        category: failure.category,
        message: failure.message,
        chargedCostCents: charged,
      });
      if (failed)
        await appendDeferredToolResultMessage({
          workspaceId: input.workspaceId,
          threadId: toolCall.threadId,
          runId: ledger.run.id,
          part: {
            type: "data-toolResult",
            data: {
              skillKey: toolCall.skillKey,
              summary: failure.message,
              failed: true,
            },
          },
          plainText: failure.message,
          costCents: charged,
        });
      return { toolCallId: toolCall.id, status: "failed" as const };
    }
  },
});
