import { z } from "zod";
import { YOUTUBE_CHAPTER_RULES } from "@/lib/chapters/youtube-chapters";

/** More than this and the list stops helping a viewer navigate. */
export const MAX_VIDEO_CHAPTERS = 30;

/** One chapter boundary as the model proposes it (drives `zodTextFormat`). */
export const chapterPickSchema = z.object({
  startSceneNumber: z.number().int(),
  title: z.string().max(200),
});

/** Structured output for chapter generation. */
export const videoChaptersOutputSchema = z.object({
  chapters: z.array(chapterPickSchema).min(1).max(MAX_VIDEO_CHAPTERS),
});

export type VideoChaptersOutput = z.infer<typeof videoChaptersOutputSchema>;

/** A stored chapter. Shape only; YouTube's rules are checked separately. */
export const videoChapterSchema = z.object({
  startMilliseconds: z.number().int().min(0),
  title: z.string().max(YOUTUBE_CHAPTER_RULES.maximumTitleLength * 2),
});

export const videoChapterListSchema = z
  .array(videoChapterSchema)
  .max(MAX_VIDEO_CHAPTERS);

/** Server-action input: generate chapters for one render. */
export const generateVideoChaptersSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
  requestNonce: z.string().min(1).max(100),
});

export const cancelVideoChaptersSchema = z.object({
  projectId: z.uuid(),
  chapterGenerationRunId: z.uuid(),
});

/**
 * Server-action input: save edited chapters. `expectedVersion` is the version
 * the editor loaded, so a save cannot silently overwrite a newer generation.
 */
export const saveVideoChaptersSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
  chapters: z
    .string()
    .max(20_000)
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: "custom", message: "Invalid chapters." });
        return z.NEVER;
      }
    })
    .pipe(videoChapterListSchema),
  includeInYouTubeDescription: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  expectedVersion: z.coerce.number().int().min(0),
});
