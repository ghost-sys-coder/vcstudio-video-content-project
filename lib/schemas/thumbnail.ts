import { z } from "zod";
import { contentPlatformSchema } from "@/lib/schemas/title-generation";
import type { SceneImageApiSize } from "@/lib/schemas/scene-image";

/**
 * Upper bound on a baked headline.
 *
 * There is deliberately no word limit — the previous 40-character ceiling forced
 * headlines to 2–4 words, which the composition guidance now handles by wrapping
 * across lines instead. This remains a *character* bound rather than being
 * removed entirely because the value is persisted and interpolated into an image
 * prompt, so it still has to be validated like any other external input; 200 is
 * far beyond anything that stays legible at feed size.
 */
export const MAX_THUMBNAIL_HEADLINE_LENGTH = 200;

export const thumbnailTextModeSchema = z.enum(["baked", "clean"]);

export const generateThumbnailSchema = z
  .object({
    projectId: z.uuid(),
    platform: contentPlatformSchema,
    textMode: thumbnailTextModeSchema,
    headlineText: z
      .string()
      .trim()
      .max(MAX_THUMBNAIL_HEADLINE_LENGTH)
      .optional()
      .default(""),
    requestNonce: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.textMode === "baked" && value.headlineText.length === 0)
      context.addIssue({
        code: "custom",
        path: ["headlineText"],
        message: "A headline is required when text is baked into the image.",
      });
  });

export const cancelThumbnailGenerationSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
});

export const regenerateThumbnailSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
  requestNonce: z.string().min(1),
});

export const dismissThumbnailSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
});

export const deleteThumbnailSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
});

export const toggleThumbnailFavoriteSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
  isFavorite: z.union([z.literal("true"), z.literal("false")]),
});

export type ThumbnailTextMode = z.infer<typeof thumbnailTextModeSchema>;
export type GenerateThumbnailInput = z.infer<typeof generateThumbnailSchema>;

/**
 * The provider size each platform's thumbnail is generated at. YouTube and
 * Facebook are consumed as landscape cards; TikTok and Instagram covers are
 * vertical. Facebook accepts landscape, so it shares the 16:9 output.
 */
export function getThumbnailSizeForPlatform(
  platform: z.infer<typeof contentPlatformSchema>,
): SceneImageApiSize {
  if (platform === "tiktok" || platform === "instagram") return "1024x1536";
  return "1536x1024";
}
