import "server-only";

import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import {
  MARKETING_CHAT_PROMPT_VERSION,
  renderMarketingChatSystemPrompt,
} from "@studio/prompts";
import {
  appendUserMessage,
  beginAssistantMessage,
  completeAssistantMessage,
  createChatThread,
  failAssistantMessage,
  renameChatThread,
} from "@/db/commands/marketing-chat-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import { countKnowledgeDocuments } from "@/db/repositories/marketing-documents.repository";
import {
  findChatThread,
  listChatMessages,
} from "@/db/repositories/marketing-chat.repository";
import type { MarketingChatMessage, WorkspaceRole } from "@/db/schema";
import {
  estimateMarketingTextCost,
  MARKETING_EXPECTED_OUTPUT_TOKENS,
} from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { ensureBrandContextSnapshot } from "@/lib/marketing/brand/compile-brand-context";
import {
  buildChatTools,
  getBillableChatToolNames,
} from "@/lib/marketing/chat/build-chat-tools";
import {
  resolveActiveChatTools,
  sumChatUsageCostCents,
} from "@/lib/marketing/chat/chat-turn-cost";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import { loadMarketingSkillDefinitions } from "@/lib/marketing/skills/load-skill-definitions";
import { can } from "@/lib/policies/workspace-policy";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import {
  chatPartsToPlainText,
  sanitiseChatMessageParts,
  type MarketingChatMessagePart,
} from "@/lib/schemas/marketing-chat-message";
import {
  deriveThreadTitle,
  getRequestedSkill,
  type MarketingChatRequest,
} from "@/lib/schemas/marketing-chat-request";

export type ChatTurnContext = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  role: WorkspaceRole;
};

/**
 * Rebuilds the SDK's message shape from stored rows.
 *
 * Validation happens here as well as on the way in, by the SDK's own check
 * rather than ours. Parts were written against the shape one version of the SDK
 * produced, and the rows outlive the dependency; a message that no longer
 * validates is a message the provider would reject with an error nobody can
 * act on.
 *
 * When the full history fails, the turn falls back to the newest message alone.
 * A reply without context is a worse answer, but it is an answer — better than
 * refusing a conversation because of one unreadable row written months ago.
 * Failed and empty rows are dropped either way: a failed turn is not something
 * the model should treat as its own prior output.
 */
async function loadModelHistory(
  rows: readonly MarketingChatMessage[],
): Promise<UIMessage[]> {
  const candidates = rows
    .filter((row) => row.status !== "failed" && row.parts.length > 0)
    .map((row) => ({ id: row.id, role: row.role, parts: row.parts }));

  const validated = await safeValidateUIMessages({ messages: candidates });
  if (validated.success) return validated.data;

  const newest = await safeValidateUIMessages({
    messages: candidates.slice(-1),
  });
  if (newest.success && newest.data.length > 0) return newest.data;

  throw new Error("MARKETING_CHAT_HISTORY_UNREADABLE");
}

export type StartChatTurnResult = {
  response: Response;
  threadId: string;
};

/**
 * Runs one chat turn end to end: accept, reserve, stream, settle.
 *
 * The ordering is the money-safety argument and it is not interchangeable:
 *
 * 1. The user message is written **before** the reservation, so a request that
 *    is refused for budget still shows the user what they asked — losing their
 *    typing to a budget error would be its own bug.
 * 2. The reservation is taken **before** the first token, because a stream that
 *    has already started cannot be un-spent.
 * 3. The assistant row opens **before** the stream, so a stream that dies
 *    leaves something for the reconciler to find.
 * 4. Settlement happens in the stream's end callback with `consumeStream`
 *    keeping it alive past a client disconnect. A user closing the tab is
 *    ordinary behaviour, not an exception.
 */
export async function startChatTurn(input: {
  context: ChatTurnContext;
  request: MarketingChatRequest;
}): Promise<StartChatTurnResult> {
  const environment = getMarketingEnvironment();
  // The hashing secrets live with the text-generation settings; the Marketing
  // Studio reuses them rather than minting a second pair, so a key computed in
  // the web app and one recomputed in a worker still agree.
  const textEnvironment = getSceneAnalysisEnvironment();
  const { workspaceId, workspaceName, userId } = input.context;

  const userText = input.request.message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const thread = input.request.threadId
    ? await findChatThread({ workspaceId, threadId: input.request.threadId })
    : await createChatThread({
        workspaceId,
        createdByUserId: userId,
        title: deriveThreadTitle(userText),
      });

  if (!thread) throw new Error("MARKETING_THREAD_NOT_FOUND");

  const userParts: MarketingChatMessagePart[] = input.request.message.parts
    .filter((part) => part.type === "text")
    .map((part) => ({ type: "text", text: part.text }));

  const accepted = await appendUserMessage({
    workspaceId,
    threadId: thread.id,
    parts: userParts,
    plainText: userText,
    requestNonce: input.request.requestNonce,
  });

  // A thread created by an earlier turn keeps its title; one that has just
  // received its first message earns one derived from what was actually said.
  if (accepted.created && thread.messageCount === 0 && input.request.threadId)
    await renameChatThread({
      workspaceId,
      threadId: thread.id,
      title: deriveThreadTitle(userText),
    });

  const [{ snapshotId, context }, documentCount, history] = await Promise.all([
    ensureBrandContextSnapshot({ workspaceId }),
    countKnowledgeDocuments({ workspaceId }),
    listChatMessages({
      workspaceId,
      threadId: thread.id,
      limit: environment.MARKETING_CHAT_HISTORY_MESSAGES,
    }),
  ]);

  const allDefinitions = await loadMarketingSkillDefinitions({ workspaceId });
  const availableDefinitions = allDefinitions.filter(
    (definition) =>
      can(input.context.role, definition.capability) &&
      (!definition.requiresBrandProfile || context.text.trim() !== ""),
  );
  const requestedSkill = getRequestedSkill(input.request);
  const forcedDefinition = requestedSkill
    ? availableDefinitions.find(
        (definition) => definition.key === requestedSkill.skillKey,
      )
    : undefined;
  if (requestedSkill && !forcedDefinition)
    throw new Error("MARKETING_SKILL_NOT_AVAILABLE");
  if (requestedSkill)
    forcedDefinition!.inputSchema.parse(requestedSkill.inputs);

  const systemPrompt = renderMarketingChatSystemPrompt({
    brandContext: context.text,
    workspaceName,
    availableTools: availableDefinitions.map(
      (definition) =>
        `${definition.key} — ${definition.toolDescription ?? definition.description}`,
    ),
    hasKnowledgeDocuments: documentCount > 0,
  });

  const messages = await loadModelHistory(history);
  const rates = {
    inputCostPerMillionCents:
      environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
    outputCostPerMillionCents:
      environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
  };

  const estimatedCostCents = estimateMarketingTextCost({
    prompt: `${systemPrompt}\n\n${messages.map((message) => chatPartsToPlainText(sanitiseChatMessageParts(message.parts))).join("\n")}`,
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.chat_turn,
    rates,
  });

  const reservation = await reserveMarketingUsage({
    workspaceId,
    operation: "chat_turn",
    estimatedCostCents,
    // Keyed on the accepted user message rather than on the nonce, because the
    // message id is what a retried request resolves to: `appendUserMessage`
    // returns the original row, so the replay reaches the original run instead
    // of reserving a second time for the same conversation turn.
    idempotencyKey: createMarketingOperationIdempotencyKey({
      secret: textEnvironment.IDEMPOTENCY_HASH_SECRET,
      workspaceId,
      operation: "chat_turn",
      subjectId: accepted.message.id,
      subjectFingerprint: context.sourceFingerprint,
      model: environment.MARKETING_CHAT_MODEL,
      promptVersion: MARKETING_CHAT_PROMPT_VERSION,
    }),
    requestedByUserId: userId,
    model: environment.MARKETING_CHAT_MODEL,
    promptVersion: MARKETING_CHAT_PROMPT_VERSION,
    // The system prompt only. The conversation is already stored as rows, and
    // duplicating it into the run record would copy the whole thread on every
    // turn for no gain in explainability.
    finalPrompt: systemPrompt,
    requestFingerprint: createRequestFingerprint(
      textEnvironment.REQUEST_FINGERPRINT_SECRET,
      systemPrompt,
    ),
    subjectKind: "chat_message",
    subjectId: accepted.message.id,
  });

  const assistant = await beginAssistantMessage({
    workspaceId,
    threadId: thread.id,
    modelId: environment.MARKETING_CHAT_MODEL,
    promptVersion: MARKETING_CHAT_PROMPT_VERSION,
    brandContextSnapshotId: snapshotId,
    runId: reservation.runId,
  });

  await markMarketingRunRunning({
    workspaceId,
    runId: reservation.runId,
    attemptCount: 1,
  });

  let settledCostCents = 0;
  let settledInputTokens = 0;
  let settledOutputTokens = 0;
  let providerRequestId: string | null = null;
  let finishReason = "";

  const result = streamText({
    model: openai(environment.MARKETING_CHAT_MODEL),
    instructions: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: buildChatTools({
      definitions: availableDefinitions,
      context: {
        workspaceId,
        userId,
        role: input.context.role,
        threadId: thread.id,
        messageId: assistant.id,
        brandContext: context.text,
        brandContextFingerprint: context.sourceFingerprint,
      },
    }),
    toolChoice: forcedDefinition
      ? { type: "tool", toolName: forcedDefinition.key }
      : "auto",
    stopWhen: stepCountIs(environment.MARKETING_CHAT_MAX_STEPS),
    prepareStep: ({ steps }) => {
      const activeTools = resolveActiveChatTools({
        accumulatedCostCents: sumChatUsageCostCents({
          usages: steps.map((step) => step.usage),
          rates,
        }),
        maxTurnCostCents: environment.MARKETING_CHAT_MAX_TURN_COST_CENTS,
        toolNames: availableDefinitions.map((definition) => definition.key),
        billableToolNames: getBillableChatToolNames(availableDefinitions),
      });
      return activeTools ? { activeTools } : {};
    },
    onEnd: (event) => {
      settledInputTokens = event.usage.inputTokens ?? 0;
      settledOutputTokens = event.usage.outputTokens ?? 0;
      settledCostCents = sumChatUsageCostCents({
        usages: [event.usage],
        rates,
      });
      providerRequestId = event.finalStep.response.id ?? null;
      finishReason = event.finishReason;
    },
  });

  // Without this the end callback never runs when the browser goes away
  // mid-stream, leaving the assistant row `streaming` and the reservation
  // `pending` until the reconciler expires it. Closing a tab is not an error.
  void result.consumeStream();

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    onEnd: async ({ responseMessage }) => {
      const parts = sanitiseChatMessageParts(responseMessage.parts);
      await completeAssistantMessage({
        workspaceId,
        messageId: assistant.id,
        threadId: thread.id,
        parts,
        plainText: chatPartsToPlainText(parts),
        inputTokens: settledInputTokens,
        outputTokens: settledOutputTokens,
        costCents: settledCostCents,
        finishReason,
        providerRequestId,
      });
      await reconcileMarketingUsage({
        workspaceId,
        runId: reservation.runId,
        reservationId: reservation.reservationId,
        operation: "chat_turn",
        actualCostCents: settledCostCents,
        inputTokens: settledInputTokens,
        outputTokens: settledOutputTokens,
        providerRequestId,
        safeMetadata: { threadId: thread.id, finishReason },
      });
    },
    onError: (error) => {
      // Runs on the stream's error path, which the end callback does not reach.
      // Both the message and the ledger have to be settled here or the turn
      // stays open forever, and the user is owed a sentence that says what
      // happened rather than a silent stop.
      const failure = classifyMarketingProviderError(error);
      void (async () => {
        await failAssistantMessage({
          workspaceId,
          messageId: assistant.id,
          threadId: thread.id,
          safeErrorMessage: failure.message,
          costCents: failure.mayHaveBilled ? estimatedCostCents : 0,
        });
        await failMarketingRun({
          workspaceId,
          runId: reservation.runId,
          reservationId: reservation.reservationId,
          operation: "chat_turn",
          category: failure.category,
          message: failure.message,
          chargedCostCents: failure.mayHaveBilled ? estimatedCostCents : 0,
        });
      })();
      return failure.message;
    },
  });

  return { response, threadId: thread.id };
}
