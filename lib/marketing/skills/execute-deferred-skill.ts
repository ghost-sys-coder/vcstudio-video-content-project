import "server-only";

import { tasks } from "@trigger.dev/sdk";
import { renderMarketingSkillPrompt } from "@studio/prompts";
import {
  attachMarketingToolCallRun,
  attachMarketingToolCallTriggerRun,
  beginMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import { attachMarketingTriggerRun } from "@/db/commands/marketing-usage-commands";
import { estimateMarketingTextCost } from "@/lib/costs/marketing-cost";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
  getSceneImageEnvironment,
} from "@/lib/env/server";
import type {
  MarketingSkillDefinition,
  SkillExecutionContext,
} from "@/lib/marketing/skills/skill-definition";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { marketingContentGenerationTask } from "@/trigger/marketing-content-generation";
import type { marketingImageGenerationTask } from "@/trigger/marketing-image-generation";

function imageSize(values: Record<string, string | number>) {
  if (values.aspectRatio === "portrait") return "1024x1536" as const;
  if (values.aspectRatio === "landscape") return "1536x1024" as const;
  return "1024x1024" as const;
}

export async function executeDeferredMarketingSkill(input: {
  definition: MarketingSkillDefinition;
  values: Record<string, string | number>;
  toolCallId: string;
  context: SkillExecutionContext;
}): Promise<{ status: "started"; toolCallId: string }> {
  const { definition, context } = input;
  const executorKey = definition.executorKey ?? definition.key;
  requireCapability(context.role, definition.capability);
  if (!definition.operation || !definition.rateLimitOperation)
    throw new Error("MARKETING_DEFERRED_SKILL_NOT_BILLABLE");
  await enforceRateLimit({
    workspaceId: context.workspaceId,
    operation: definition.rateLimitOperation,
  });
  const marketingEnvironment = getMarketingEnvironment();
  const hashEnvironment = getSceneAnalysisEnvironment();
  const prompt = renderMarketingSkillPrompt({
    skillLabel: definition.label,
    instructions: definition.instructions,
    inputs: input.values,
    brandContext: context.brandContext,
  });
  const estimatedCostCents =
    definition.billing.kind === "text"
      ? estimateMarketingTextCost({
          prompt,
          expectedOutputTokens: definition.billing.expectedOutputTokens,
          rates: {
            inputCostPerMillionCents:
              marketingEnvironment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
            outputCostPerMillionCents:
              marketingEnvironment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
          },
        })
      : definition.billing.kind === "image"
        ? (() => {
            const env = getSceneImageEnvironment();
            return estimateSceneImageCost({
              prompt,
              quality: definition.billing.quality,
              size: imageSize(input.values),
              referenceAssetCount: 0,
              outputCostMatrix: createSceneImageOutputCostMatrix(env),
              textInputCostPerMillionCents:
                env.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
              referenceInputReserveCents:
                env.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
              safetyMarginBasisPoints: 0,
            }).estimatedCostCents;
          })()
        : 0;
  const toolRow = await beginMarketingToolCall({
    workspaceId: context.workspaceId,
    threadId: context.threadId,
    messageId: context.messageId,
    toolCallId: input.toolCallId,
    skillKey: definition.key,
    toolInput: definition.userSkillId
      ? {
          ...input.values,
          __userSkillId: definition.userSkillId,
          __executorKey: executorKey,
          __skillLabel: definition.label,
        }
      : input.values,
    estimatedCostCents,
    status: "pending",
  });
  if (toolRow.triggerRunId || toolRow.status === "succeeded")
    return { status: "started", toolCallId: toolRow.id };
  try {
    const model =
      definition.billing.kind === "image"
        ? getSceneImageEnvironment().OPENAI_IMAGE_MODEL
        : marketingEnvironment.MARKETING_CHAT_MODEL;
    const reservation = await reserveMarketingUsage({
      workspaceId: context.workspaceId,
      operation: definition.operation,
      estimatedCostCents,
      idempotencyKey: createMarketingOperationIdempotencyKey({
        secret: hashEnvironment.IDEMPOTENCY_HASH_SECRET,
        workspaceId: context.workspaceId,
        operation: definition.operation,
        subjectId: toolRow.id,
        subjectFingerprint: context.brandContextFingerprint,
        model,
        promptVersion: definition.promptVersion,
      }),
      requestedByUserId: context.userId,
      model,
      promptVersion: definition.promptVersion,
      skillKey: definition.key,
      skillVersion: definition.skillVersion ?? 1,
      brandContextFingerprint: context.brandContextFingerprint,
      finalPrompt: prompt,
      requestFingerprint: createRequestFingerprint(
        hashEnvironment.REQUEST_FINGERPRINT_SECRET,
        prompt,
      ),
      subjectKind: "chat_tool_call",
      subjectId: toolRow.id,
    });
    await attachMarketingToolCallRun({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      runId: reservation.runId,
    });
    const payload = {
      workspaceId: context.workspaceId,
      toolCallId: toolRow.id,
    };
    const handle =
      definition.billing.kind === "image"
        ? await tasks.trigger<typeof marketingImageGenerationTask>(
            "marketing-image-generation",
            payload,
          )
        : await tasks.trigger<typeof marketingContentGenerationTask>(
            "marketing-content-generation",
            payload,
          );
    await Promise.all([
      attachMarketingToolCallTriggerRun({
        workspaceId: context.workspaceId,
        id: toolRow.id,
        triggerRunId: handle.id,
      }),
      attachMarketingTriggerRun({
        workspaceId: context.workspaceId,
        runId: reservation.runId,
        triggerRunId: handle.id,
      }),
    ]);
    return { status: "started", toolCallId: toolRow.id };
  } catch (error) {
    await failMarketingToolCall({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      category: "dispatch_failed",
      message: "This work could not be queued. Try again.",
      actualCostCents: 0,
    });
    throw error;
  }
}
