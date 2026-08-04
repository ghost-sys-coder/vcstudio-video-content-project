import { z } from "zod";
import {
  MARKETING_CHAT_MAX_USER_CHARACTERS,
  marketingChatTextPartSchema,
} from "@/lib/schemas/marketing-chat-message";

/**
 * The chat request contract, and the most security-relevant schema in the
 * Marketing Studio.
 *
 * The browser sends **exactly one** message: the newest user turn. History is
 * reloaded from the database on the server. An endpoint that accepts a full
 * message array has handed the caller the ability to forge an assistant turn
 * claiming a tool already ran, to rewrite what the business said about itself,
 * or to inject a system message — and it has done so in a request that looks
 * completely ordinary.
 *
 * `strict()` is deliberate: a request carrying a `messages` array is rejected
 * outright rather than quietly stripped, so a client built against the wrong
 * shape fails loudly during development instead of silently losing context in
 * production.
 */
export const marketingChatRequestSchema = z
  .object({
    /** Null starts a new thread; the server mints the id. */
    threadId: z.uuid().nullable(),
    /**
     * Client-generated, stable across retries of the same send. The partial
     * unique index on `(thread_id, request_nonce)` turns a retry into a no-op
     * instead of a second charge.
     */
    requestNonce: z.uuid(),
    message: z
      .object({
        id: z.string().min(1).max(200),
        // Only `user`. The role is not a field the client gets to choose
        // between; it is a constant that exists so the payload reads clearly.
        role: z.literal("user"),
        parts: z.array(marketingChatTextPartSchema).min(1).max(4),
      })
      .strict(),
  })
  .strict()
  .refine(
    (value) =>
      value.message.parts.reduce(
        (total, part) => total + part.text.length,
        0,
      ) <= MARKETING_CHAT_MAX_USER_CHARACTERS,
    { message: "That message is too long." },
  )
  .refine(
    (value) => value.message.parts.some((part) => part.text.trim() !== ""),
    { message: "That message is empty." },
  );

export type MarketingChatRequest = z.infer<typeof marketingChatRequestSchema>;

export const createMarketingThreadSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export const archiveMarketingThreadSchema = z.object({
  threadId: z.uuid(),
});

/**
 * Derives a thread title from the first user message.
 *
 * Server-side rather than client-supplied for the same reason the rest of the
 * payload is narrow: a title is displayed in a list next to other threads, and
 * nothing displayed should originate from an unvalidated field when it can be
 * derived from one that is already validated.
 */
export const MARKETING_THREAD_TITLE_MAX_LENGTH = 80;

export function deriveThreadTitle(firstUserMessage: string): string {
  const collapsed = firstUserMessage.replace(/\s+/g, " ").trim();
  if (collapsed === "") return "New conversation";
  if (collapsed.length <= MARKETING_THREAD_TITLE_MAX_LENGTH) return collapsed;
  const cut = collapsed.slice(0, MARKETING_THREAD_TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  // Prefer a word boundary, but only when one exists late enough that the title
  // still says something; a single very long token keeps its hard cut.
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut.trimEnd()}…`;
}
