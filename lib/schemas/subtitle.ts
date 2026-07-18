import { z } from "zod";
import { captionStyleSchema } from "@/lib/subtitles/caption-style";

export const subtitleGranularitySchema = z.enum(["scene", "sentence"]);

export const subtitleRouteParamsSchema = z.object({
  projectId: z.uuid(),
});

export const subtitleExportQuerySchema = z.object({
  format: z.enum(["srt", "vtt"]),
});

/**
 * Caption style and granularity update. Caption style is validated by the
 * canonical schema; granularity switches how narration is segmented.
 */
export const updateSubtitleSettingsSchema = z.object({
  projectId: z.uuid(),
  granularity: subtitleGranularitySchema,
  captionStyle: captionStyleSchema,
});

/**
 * A single manual text override, keyed by `${sceneVersionId}:${index}`. An empty
 * string clears the override and restores the derived text.
 */
export const updateSubtitleSegmentSchema = z.object({
  projectId: z.uuid(),
  segmentKey: z
    .string()
    .trim()
    .regex(
      /^[0-9a-fA-F-]{36}:\d{1,4}$/,
      "Segment key must be `sceneVersionId:index`.",
    ),
  text: z.string().trim().max(500),
});

export type SubtitleGranularityInput = z.infer<
  typeof subtitleGranularitySchema
>;
export type UpdateSubtitleSettingsInput = z.infer<
  typeof updateSubtitleSettingsSchema
>;
export type UpdateSubtitleSegmentInput = z.infer<
  typeof updateSubtitleSegmentSchema
>;
