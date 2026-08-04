import "server-only";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { renderMarketingSkillPrompt } from "@studio/prompts";
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

export async function executeInlineMarketingSkill(input: {
  definition: MarketingSkillDefinition;
  values: Record<string, string | number>;
  toolCallId: string;
  context: SkillExecutionContext;
}): Promise<{ text: string; skillKey: string }> {
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
  const prompt = renderMarketingSkillPrompt({
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
    return { text: toolRow.output.text, skillKey: definition.key };
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
    await completeMarketingToolCall({
      workspaceId: context.workspaceId,
      id: toolRow.id,
      output: { text: result.text },
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
    return { text: result.text, skillKey: definition.key };
  } catch (error) {
    const failure = classifyMarketingProviderError(error);
    const charged = failure.mayHaveBilled ? estimatedCostCents : 0;
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
