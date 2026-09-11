import { z } from "zod";

/**
 * Cue times arriving from a browser.
 *
 * Bounded here, then checked against the scene's real narration length on the
 * server. The editor enforces the same invariants before it sends anything, but
 * those checks are a convenience for the person typing, not a guarantee: the
 * request is what the database acts on, so the request is what must be proven
 * sound.
 *
 * Twelve hours is the ceiling on a single cue time. It is far beyond any
 * narration this tool produces and exists only to keep an absurd number out of
 * the integer columns.
 */
const MAX_CUE_MILLISECONDS = 12 * 60 * 60 * 1000;

export const captionCueSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  startMilliseconds: z.number().int().nonnegative().max(MAX_CUE_MILLISECONDS),
  endMilliseconds: z.number().int().positive().max(MAX_CUE_MILLISECONDS),
});

export const saveCaptionCuesSchema = z.object({
  projectId: z.uuid(),
  sceneVersionId: z.uuid(),
  audioGenerationId: z.uuid(),
  /** Null when no corrections exist yet; the revision the editor was shown. */
  expectedRevision: z.number().int().positive().nullable(),
  cues: z.array(captionCueSchema).min(1).max(200),
});

export const clearCaptionCuesSchema = z.object({
  projectId: z.uuid(),
  sceneVersionId: z.uuid(),
  audioGenerationId: z.uuid(),
});

export type SaveCaptionCuesInput = z.infer<typeof saveCaptionCuesSchema>;
