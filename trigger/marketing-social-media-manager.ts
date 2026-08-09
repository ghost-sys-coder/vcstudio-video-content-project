import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk";
import { generateObject } from "ai";
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
import { countGeneratedMarketingItemsSince } from "@/db/repositories/marketing-schedules.repository";
import { findMarketingRun } from "@/db/repositories/marketing-usage.repository";
import type { ContentPlatform } from "@/db/schema";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import { evaluateScheduleCaps } from "@/lib/marketing/schedules/schedule-caps";
import { getStartOfZonedDay } from "@/lib/marketing/schedules/recurrence";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { marketingSocialMediaManagerOutputSchema } from "@/lib/schemas/marketing-social-media-manager";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";

const payloadSchema = z.object({ workspaceId: z.uuid(), toolCallId: z.uuid() });

export const marketingSocialMediaManagerTask = task({
  id: "marketing-social-media-manager",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: { maxAttempts: 2, minTimeoutInMs: 2_000, maxTimeoutInMs: 20_000 },
  maxDuration: 300,
  run: async (payload: z.infer<typeof payloadSchema>, { ctx }) => {
    const input = payloadSchema.parse(payload);
    const toolCall = await findMarketingToolCall(input);
    if (!toolCall || !toolCall.runId)
      throw new Error("Marketing manager run not found.");
    if (["succeeded", "failed", "cancelled"].includes(toolCall.status))
      return { status: toolCall.status };
    const ledger = await findMarketingRun({
      workspaceId: input.workspaceId,
      runId: toolCall.runId,
    });
    const hashes = getSceneAnalysisEnvironment();
    if (
      !ledger ||
      ledger.reservation.status !== "pending" ||
      ledger.reservation.expiresAt.getTime() < Date.now() ||
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
        message: "This plan expired before it could start.",
        actualCostCents: 0,
      });
      return { status: "failed" as const };
    }
    const settings = await loadMarketingSettings({
      workspaceId: input.workspaceId,
    });
    const itemCount = Math.min(
      5,
      Math.max(1, Number(toolCall.input.itemCount) || 1),
    );
    const generatedToday = await countGeneratedMarketingItemsSince({
      workspaceId: input.workspaceId,
      since: getStartOfZonedDay(new Date(), settings.defaultTimezone),
    });
    const cap = evaluateScheduleCaps({
      itemsGeneratedToday: generatedToday,
      requestedItems: itemCount,
      dailyItemCap: settings.dailyMaxGeneratedItems,
      ruleCommittedCents: 0,
      estimatedCostCents: ledger.run.estimatedCostCents,
      monthlyRuleBudgetCents: null,
    });
    if (!cap.allowed) {
      await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: "cap_refused",
        message:
          "The weekly plan would exceed the workspace daily generation cap.",
        actualCostCents: 0,
      });
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        category: "cap_refused",
        message: "The weekly plan exceeded the daily generation cap.",
        chargedCostCents: 0,
      });
      return { status: "failed" as const };
    }
    await markMarketingRunRunning({
      workspaceId: input.workspaceId,
      runId: ledger.run.id,
      attemptCount: ctx.attempt.number,
    });
    const environment = getMarketingEnvironment();
    try {
      const result = await generateObject({
        model: openai(environment.MARKETING_CHAT_MODEL),
        schema: marketingSocialMediaManagerOutputSchema,
        prompt: `${ledger.run.finalPrompt}\nReturn exactly ${itemCount} distinct drafts.`,
      });
      const plan = marketingSocialMediaManagerOutputSchema.parse(result.object);
      if (plan.items.length !== itemCount)
        throw new Error("MANAGER_OUTPUT_INCOMPLETE");
      const platform = String(toolCall.input.platform) as ContentPlatform;
      const contentItemIds: string[] = [];
      for (const planned of plan.items) {
        const item = await createMarketingContentItem({
          workspaceId: input.workspaceId,
          kind: "social_post",
          platform,
          title: planned.title,
          bodyDocument: plainTextToPortableDocument(planned.body),
          bodyPlainText: planned.body,
          sourceRunId: ledger.run.id,
          createdByUserId: ledger.run.requestedByUserId,
          structuredPayload: {
            managerRationale: planned.rationale,
            orchestrationSkill: "social_media_manager",
          },
        });
        contentItemIds.push(item.id);
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
      const text = `${contentItemIds.length} social drafts are ready for human review.`;
      await completeMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        output: { text, contentItemIds },
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
          skillKey: "social_media_manager",
          generatedItems: contentItemIds.length,
        },
      });
      await appendDeferredToolResultMessage({
        workspaceId: input.workspaceId,
        threadId: toolCall.threadId,
        runId: ledger.run.id,
        part: {
          type: "data-toolResult",
          data: { skillKey: "social_media_manager", summary: text },
        },
        plainText: text,
        costCents: actualCostCents,
      });
      return { status: "succeeded" as const, contentItemIds };
    } catch (error) {
      const failure = classifyMarketingProviderError(error);
      const charged = failure.mayHaveBilled ? ledger.run.estimatedCostCents : 0;
      await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: failure.category,
        message: "The social media plan could not be generated.",
        actualCostCents: charged,
      });
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        category: failure.category,
        message: "The social media plan could not be generated.",
        chargedCostCents: charged,
      });
      return { status: "failed" as const };
    }
  },
});
