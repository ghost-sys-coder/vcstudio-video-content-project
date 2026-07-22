import { z } from "zod";
import {
  MAX_PUBLICATION_TAG_LENGTH,
  MAX_PUBLICATION_TAGS,
  YOUTUBE_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_TITLE_MAX_LENGTH,
} from "@/lib/publishing/platform-limits";

export { MAX_PUBLICATION_TAG_LENGTH, MAX_PUBLICATION_TAGS };

export const publicationVisibilitySchema = z.enum([
  "private",
  "unlisted",
  "public",
]);

/**
 * Tags arrive as a single comma-separated field. Normalizing here (rather than
 * in the component) keeps the parsing rule in one tested place.
 */
const tagsSchema = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  )
  .pipe(
    z
      .array(z.string().max(MAX_PUBLICATION_TAG_LENGTH))
      .max(MAX_PUBLICATION_TAGS),
  );

const publishBaseSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
  connectionId: z.uuid(),
  requestNonce: z.string().min(1),
});

const standardPublishMetadataSchema = z.object({
  title: z.string().trim().min(1).max(YOUTUBE_TITLE_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(YOUTUBE_DESCRIPTION_MAX_LENGTH)
    .default(""),
  tags: tagsSchema,
});

export const publishVideoSchema = z.discriminatedUnion("platform", [
  publishBaseSchema.extend({
    platform: z.literal("youtube"),
    ...standardPublishMetadataSchema.shape,
    visibility: publicationVisibilitySchema,
  }),
  publishBaseSchema.extend({
    platform: z.literal("facebook"),
    ...standardPublishMetadataSchema.shape,
    visibility: z.enum(["private", "public"]),
  }),
  publishBaseSchema.extend({
    platform: z.literal("instagram"),
    caption: z.string().max(2200),
    shareToFeed: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    visibility: z.literal("public"),
  }),
]);

export const cancelPublicationSchema = z.object({
  projectId: z.uuid(),
  publicationId: z.uuid(),
});

export const disconnectPlatformSchema = z.object({
  connectionId: z.uuid(),
});

export type PublishVideoInput = z.infer<typeof publishVideoSchema>;
export type PublicationVisibilityValue = z.infer<
  typeof publicationVisibilitySchema
>;
