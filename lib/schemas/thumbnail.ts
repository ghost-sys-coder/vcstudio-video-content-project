import { z } from "zod";
import { contentPlatformSchema } from "@/lib/schemas/title-generation";
import {
  SCENE_IMAGE_UPLOAD_CONTENT_TYPES,
  type SceneImageApiSize,
} from "@/lib/schemas/scene-image";

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

/**
 * Authorizes an upload of a thumbnail the creator already has.
 *
 * The declared content type and byte length are bound into the signed PUT, so
 * they have to be validated here even though the file itself is re-inspected
 * server-side afterwards. Nothing the browser says about the file is trusted
 * as the final word.
 */
export function createThumbnailUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return z.object({
    platform: contentPlatformSchema,
    contentType: z
      .enum(SCENE_IMAGE_UPLOAD_CONTENT_TYPES)
      .refine((value) => input.allowedTypes.includes(value), {
        message: "Unsupported image type.",
      }),
    fileName: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(input.maximumBytes),
  });
}

export function completeThumbnailUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return createThumbnailUploadSchema(input)
    .omit({ fileName: true })
    .extend({
      thumbnailGenerationId: z.uuid(),
      objectKey: z.string().min(1).max(512),
    });
}

export type ThumbnailUploadInput = z.infer<
  ReturnType<typeof createThumbnailUploadSchema>
>;
export type CompleteThumbnailUploadInput = z.infer<
  ReturnType<typeof completeThumbnailUploadSchema>
>;
