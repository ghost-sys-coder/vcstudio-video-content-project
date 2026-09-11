import { z } from "zod";
import {
  MAX_CLAIM_NOTE_LENGTH,
  MAX_CLAIM_QUOTE_LENGTH,
  MAX_SOURCE_NOTE_LENGTH,
  MAX_SOURCE_TITLE_LENGTH,
  MAX_SOURCE_URL_LENGTH,
} from "@/lib/editorial/source-input";

/**
 * Input contracts for the editorial review actions.
 *
 * Every free-text field is bounded here rather than only at the database, so an
 * oversized paste is refused before it reaches a query. The sanitizing pass in
 * `source-input.ts` runs after parsing, because stripping characters first
 * would let a string slip under a length limit it did not actually meet.
 */

const uuid = z.string().uuid();
const projectId = uuid;

export const addSourceInputSchema = z
  .object({
    projectId,
    kind: z.enum(["link", "note"]),
    title: z.string().trim().min(1).max(MAX_SOURCE_TITLE_LENGTH),
    url: z.string().max(MAX_SOURCE_URL_LENGTH).optional().default(""),
    notes: z.string().max(MAX_SOURCE_NOTE_LENGTH).optional().default(""),
  })
  .refine((value) => value.kind !== "link" || value.url.trim().length > 0, {
    message: "A link source needs a link.",
    path: ["url"],
  });

export const archiveSourceInputSchema = z.object({
  projectId,
  sourceId: uuid,
});

export const addClaimInputSchema = z.object({
  projectId,
  quotedText: z.string().trim().min(1).max(MAX_CLAIM_QUOTE_LENGTH),
});

export const reviewClaimInputSchema = z.object({
  projectId,
  claimId: uuid,
  reviewState: z.enum(["unchecked", "supported", "disputed"]),
  reviewNote: z.string().max(MAX_CLAIM_NOTE_LENGTH).optional().default(""),
});

export const deleteClaimInputSchema = z.object({
  projectId,
  claimId: uuid,
});

export const citeSourceInputSchema = z.object({
  projectId,
  claimId: uuid,
  sourceId: uuid,
  stance: z.enum(["supports", "disputes"]),
  excerpt: z.string().max(MAX_SOURCE_NOTE_LENGTH).optional().default(""),
});

export const removeCitationInputSchema = z.object({
  projectId,
  claimId: uuid,
  sourceId: uuid,
});

export const signoffInputSchema = z.object({
  projectId,
  /**
   * The fingerprint the reviewer was looking at. Sent back so a sign-off made
   * against a stale page cannot be recorded as covering the current draft.
   */
  scriptFingerprint: z.string().min(1).max(200_000),
  note: z.string().max(MAX_CLAIM_NOTE_LENGTH).optional().default(""),
});

export type AddSourceInput = z.infer<typeof addSourceInputSchema>;
export type AddClaimInput = z.infer<typeof addClaimInputSchema>;
export type ReviewClaimInput = z.infer<typeof reviewClaimInputSchema>;
export type CiteSourceInput = z.infer<typeof citeSourceInputSchema>;
export type SignoffInput = z.infer<typeof signoffInputSchema>;
