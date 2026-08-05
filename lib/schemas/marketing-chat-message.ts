import { z } from "zod";

/**
 * What a persisted chat message may contain.
 *
 * This is not decoration. Persisted parts are re-read on the next turn and fed
 * back to the model as history, so anything stored here is something the model
 * will later treat as its own prior output. Validating on the way in bounds
 * both what a corrupted row can do and how large a replayed history can get.
 *
 * The shapes mirror the AI SDK's `UIMessage` parts, narrowed to the subset this
 * slice actually produces. A part the SDK invents later is dropped rather than
 * stored, which is the safe direction: an unrecognised part cannot be rendered
 * anyway.
 */

/** One part cannot exceed this; a whole message is bounded by the part count. */
export const MARKETING_CHAT_MAX_PART_CHARACTERS = 24_000;
export const MARKETING_CHAT_MAX_PARTS = 64;
/** What a user may type in one turn, before any brand context is added. */
export const MARKETING_CHAT_MAX_USER_CHARACTERS = 8_000;

export const marketingChatTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(MARKETING_CHAT_MAX_PART_CHARACTERS),
  state: z.enum(["streaming", "done"]).optional(),
});

export const marketingChatReasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string().max(MARKETING_CHAT_MAX_PART_CHARACTERS),
  state: z.enum(["streaming", "done"]).optional(),
});

export const marketingChatStepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

/**
 * A tool invocation, as the SDK names it: `tool-<toolName>`.
 *
 * `input` and `output` stay `unknown` on purpose. Each tool owns its own
 * contract and validates its own arguments at the call site; re-declaring those
 * shapes here would mean two definitions to keep in step, and the persistence
 * layer has no business knowing what a given tool returns.
 */
export const marketingChatToolPartSchema = z.object({
  type: z.string().regex(/^tool-[a-z0-9_]+$/),
  toolCallId: z.string().min(1).max(200),
  state: z.enum([
    "input-streaming",
    "input-available",
    "output-available",
    "output-error",
  ]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().max(4_000).optional(),
});

export const marketingChatToolResultPartSchema = z.object({
  type: z.literal("data-toolResult"),
  data: z.object({
    skillKey: z.string().min(1).max(100),
    summary: z.string().min(1).max(4_000),
    contentItemId: z.uuid().optional(),
    mediaAssetId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    campaignId: z.uuid().optional(),
    failed: z.boolean().optional(),
  }),
});
export type MarketingChatToolResultData = z.infer<
  typeof marketingChatToolResultPartSchema
>["data"];

export const marketingChatMessagePartSchema = z.union([
  marketingChatTextPartSchema,
  marketingChatReasoningPartSchema,
  marketingChatStepStartPartSchema,
  marketingChatToolPartSchema,
  marketingChatToolResultPartSchema,
]);

export const marketingChatMessagePartsSchema = z
  .array(marketingChatMessagePartSchema)
  .max(MARKETING_CHAT_MAX_PARTS);

export type MarketingChatMessagePart = z.infer<
  typeof marketingChatMessagePartSchema
>;
export type MarketingChatTextPart = z.infer<typeof marketingChatTextPartSchema>;

/**
 * A hand-written guard rather than a `type === "text"` comparison, because the
 * tool part's `type` is a pattern-matched string rather than a literal, so the
 * union is not discriminated and TypeScript cannot narrow it on its own.
 */
export function isMarketingChatTextPart(
  part: MarketingChatMessagePart,
): part is MarketingChatTextPart {
  return part.type === "text";
}

/**
 * Keeps only the parts that validate, rather than rejecting the whole message.
 *
 * A stream that produced one malformed part still produced an answer the user
 * watched arrive. Discarding the entire assistant turn because of it would lose
 * work the user has already seen and already paid for, which is worse than
 * storing a slightly shorter message.
 */
export function sanitiseChatMessageParts(
  parts: unknown,
): MarketingChatMessagePart[] {
  if (!Array.isArray(parts)) return [];
  const kept: MarketingChatMessagePart[] = [];
  for (const part of parts) {
    if (kept.length >= MARKETING_CHAT_MAX_PARTS) break;
    const parsed = marketingChatMessagePartSchema.safeParse(part);
    if (parsed.success) kept.push(parsed.data);
  }
  return kept;
}

/** The plain-text projection used for search, previews, and thread titles. */
export function chatPartsToPlainText(
  parts: readonly MarketingChatMessagePart[],
): string {
  return parts
    .filter(isMarketingChatTextPart)
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}
