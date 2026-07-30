import { z } from "zod";
import type { MediaAssetKind } from "@/db/schema";

/**
 * Content types the media library accepts, split by kind. Deliberately an
 * allow-list rather than an `image/*` prefix test: the extension used to build
 * the storage key, the `sharp` decode on completion, and every platform's own
 * accepted-format list are all derived from this, so an unrecognised type must
 * be rejected at the door rather than stored and discovered later.
 */
export const MEDIA_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MEDIA_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const mediaContentTypeSchema = z.enum([
  ...MEDIA_IMAGE_CONTENT_TYPES,
  ...MEDIA_VIDEO_CONTENT_TYPES,
]);

export type MediaContentType = z.infer<typeof mediaContentTypeSchema>;

export const MEDIA_ASSET_KIND_BY_CONTENT_TYPE = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
} as const satisfies Record<MediaContentType, MediaAssetKind>;

export const MEDIA_FILE_EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const satisfies Record<MediaContentType, string>;

export const MAX_MEDIA_TITLE_LENGTH = 200;
export const MAX_MEDIA_ALT_TEXT_LENGTH = 1000;
export const MAX_MEDIA_TAGS = 20;
export const MAX_MEDIA_TAG_LENGTH = 40;
export const MAX_MEDIA_FILE_NAME_LENGTH = 255;

/** Highest C0 control code point, and the lone C1 control (DEL). */
const LAST_CONTROL_CODE_POINT = 31;
const DELETE_CODE_POINT = 127;

/**
 * Reduces a browser-supplied file name to something safe to store and redisplay.
 * The result is never used to build a storage key — keys are derived from the
 * asset's UUID — so this only has to defend the database and the UI: drop any
 * directory prefix, remove control characters, and collapse whitespace.
 *
 * Written as a code-point filter rather than a regular expression so no control
 * characters appear literally in this file.
 */
export function sanitizeMediaFileName(fileName: string): string {
  const withoutPath = fileName.split(/[\\/]/).pop() ?? "";
  const printable = Array.from(withoutPath)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        codePoint > LAST_CONTROL_CODE_POINT && codePoint !== DELETE_CODE_POINT
      );
    })
    .join("");
  return printable
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MEDIA_FILE_NAME_LENGTH);
}

const fileNameSchema = z
  .string()
  .min(1)
  .max(MAX_MEDIA_FILE_NAME_LENGTH)
  .transform(sanitizeMediaFileName)
  .refine((value) => value.length > 0, "A file name is required.");

const tagsSchema = z
  .array(z.string().trim().min(1).max(MAX_MEDIA_TAG_LENGTH))
  .max(MAX_MEDIA_TAGS)
  // Order-preserving de-duplication, so the same tag typed twice is stored once.
  .transform((tags) => [...new Set(tags)]);

export const requestMediaUploadSchema = z.object({
  contentType: mediaContentTypeSchema,
  fileName: fileNameSchema,
  sizeBytes: z.number().int().positive(),
  /**
   * Read from a `<video>` element by the browser. Untrusted and advisory — the
   * web runtime has no ffprobe — so it is range-checked here and treated as a
   * hint everywhere downstream.
   */
  durationMilliseconds: z.number().int().min(0).nullable().default(null),
});

export const completeMediaUploadSchema = z.object({
  mediaAssetId: z.uuid(),
  objectKey: z.string().min(1).max(512),
  contentType: mediaContentTypeSchema,
  sizeBytes: z.number().int().positive(),
  durationMilliseconds: z.number().int().min(0).nullable().default(null),
});

export const updateMediaAssetSchema = z.object({
  mediaAssetId: z.uuid(),
  title: z.string().trim().max(MAX_MEDIA_TITLE_LENGTH),
  altText: z.string().trim().max(MAX_MEDIA_ALT_TEXT_LENGTH),
  tags: tagsSchema,
});

export const deleteMediaAssetSchema = z.object({
  mediaAssetId: z.uuid(),
});

export type RequestMediaUploadInput = z.infer<typeof requestMediaUploadSchema>;
export type CompleteMediaUploadInput = z.infer<
  typeof completeMediaUploadSchema
>;
export type UpdateMediaAssetInput = z.infer<typeof updateMediaAssetSchema>;
