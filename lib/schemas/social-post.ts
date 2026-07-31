import { z } from "zod";
import { portableDocumentSchema } from "@/lib/social/portable-document";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const MAX_POST_NAME_LENGTH = 120;
export const MAX_MEDIA_ASSETS_PER_POST = 20;

export const socialPostPlatformSchema = z.enum(SOCIAL_POST_PLATFORMS);

export const createSocialPostSchema = z.object({
  name: z.string().trim().max(MAX_POST_NAME_LENGTH).default(""),
  projectId: z.uuid().nullable().default(null),
});

/**
 * One attachment as the browser names it. `source` decides which table the id
 * belongs to, so a crafted request cannot pass a render id where a library
 * asset is expected and slip past the workspace check on the wrong table.
 */
export const socialPostAttachmentRefSchema = z.object({
  source: z.enum(["library", "render"]),
  id: z.uuid(),
});

export const saveSocialPostSchema = z.object({
  postId: z.uuid(),
  /** Optimistic lock; a stale composer tab is rejected rather than applied. */
  expectedVersion: z.coerce.number().int().min(1),
  name: z.string().trim().max(MAX_POST_NAME_LENGTH),
  bodyDocument: portableDocumentSchema,
  attachments: z
    .array(socialPostAttachmentRefSchema)
    .max(MAX_MEDIA_ASSETS_PER_POST)
    // The same file twice in one post is always a mistake, and the
    // (postId, mediaAssetId) / (postId, renderId) unique indexes would reject it
    // anyway.
    .refine((refs) => {
      const keys = refs.map((ref) => `${ref.source}:${ref.id}`);
      return new Set(keys).size === keys.length;
    }, "The same media cannot be attached twice."),
});

export const MAX_POST_DESTINATIONS = 10;

export const publishSocialPostSchema = z.object({
  postId: z.uuid(),
  connectionIds: z
    .array(z.uuid())
    .min(1, "Choose at least one account.")
    .max(MAX_POST_DESTINATIONS),
  /** Distinct per intentional publish, so a deliberate re-post is allowed. */
  requestNonce: z.string().min(8).max(64),
});

export const scheduleSocialPostSchema = z.object({
  postId: z.uuid(),
  /** An absolute instant. The browser sends an ISO string built from local time. */
  scheduledAt: z.coerce.date(),
  connectionIds: z
    .array(z.uuid())
    .min(1, "Choose at least one account.")
    .max(MAX_POST_DESTINATIONS),
  /** IANA zone, kept only so the UI can redisplay the author's intent. */
  timezone: z.string().trim().min(1).max(64),
  requestNonce: z.string().min(8).max(64),
});

export const MAX_QUICK_COMMENTARY_LENGTH = 3000;

/** The publish page's "share this render" box. */
export const createPostFromRenderSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
  commentary: z.string().trim().max(MAX_QUICK_COMMENTARY_LENGTH),
});

export const cancelSocialPostScheduleSchema = z.object({ postId: z.uuid() });

export const deleteSocialPostSchema = z.object({ postId: z.uuid() });

export type CreateSocialPostInput = z.infer<typeof createSocialPostSchema>;
export type SaveSocialPostInput = z.infer<typeof saveSocialPostSchema>;
