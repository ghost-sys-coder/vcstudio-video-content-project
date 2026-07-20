import { z } from "zod";

/** How many title options a single generation run may request/produce. */
export const MIN_TITLE_OPTIONS = 3;
export const MAX_TITLE_OPTIONS = 8;
export const DEFAULT_TITLE_OPTIONS = 5;

export const contentPlatformSchema = z.enum([
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
]);

export type ContentPlatformValue = z.infer<typeof contentPlatformSchema>;

/** A single generated title option (drives `zodTextFormat`). */
export const titleOptionSchema = z.object({
  text: z.string().min(1).max(200),
  rationale: z.string().max(400),
  hookType: z.string().max(60),
});

/** Structured output for AI platform-title generation. */
export const titleGenerationOutputSchema = z.object({
  titles: z.array(titleOptionSchema).min(1).max(MAX_TITLE_OPTIONS),
});

export type TitleOption = z.infer<typeof titleOptionSchema>;
export type TitleGenerationOutput = z.infer<typeof titleGenerationOutputSchema>;

/** Server-action input: start a title-generation run for one platform. */
export const generateTitlesSchema = z.object({
  projectId: z.uuid(),
  platform: contentPlatformSchema,
  requestNonce: z.string().min(1),
  optionCount: z.coerce
    .number()
    .int()
    .min(MIN_TITLE_OPTIONS)
    .max(MAX_TITLE_OPTIONS)
    .default(DEFAULT_TITLE_OPTIONS),
});

export const cancelTitleGenerationSchema = z.object({
  projectId: z.uuid(),
  titleGenerationRunId: z.uuid(),
});

export const toggleTitleFavoriteSchema = z.object({
  projectId: z.uuid(),
  suggestionId: z.uuid(),
  isFavorite: z.union([z.literal("true"), z.literal("false")]),
});
