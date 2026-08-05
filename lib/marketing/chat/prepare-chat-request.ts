import type { UIMessage } from "ai";

export type MarketingSkillInvocationPart = {
  type: "data-skillInvocation";
  skillKey: string;
  inputs: Record<string, string>;
};

export type MarketingChatSendBody = {
  requestNonce: string;
  skillInvocation?: MarketingSkillInvocationPart;
};

/** Narrows the AI SDK payload to the server's strict public contract. */
export function prepareMarketingChatRequest(input: {
  messages: readonly UIMessage[];
  body: MarketingChatSendBody;
  threadId: string;
}) {
  const newest = input.messages.at(-1);
  const textParts = newest?.parts.filter((part) => part.type === "text") ?? [];

  return {
    body: {
      threadId: input.threadId,
      requestNonce: input.body.requestNonce,
      message: newest
        ? {
            id: newest.id,
            role: "user" as const,
            parts: [
              ...textParts,
              ...(input.body.skillInvocation
                ? [input.body.skillInvocation]
                : []),
            ],
          }
        : undefined,
    },
  };
}
