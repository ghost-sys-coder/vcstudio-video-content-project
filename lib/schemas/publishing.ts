import { z } from "zod";
import {
  MAX_PUBLICATION_TAG_LENGTH,
  MAX_PUBLICATION_TAGS,
  YOUTUBE_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_TITLE_MAX_LENGTH,
} from "@/lib/publishing/platform-limits";
import { contentPlatformSchema } from "@/lib/schemas/title-generation";

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

export const publishVideoSchema = z
  .object({
    projectId: z.uuid(),
    renderId: z.uuid(),
    connectionId: z.uuid(),
    platform: contentPlatformSchema,
    title: z.string().trim().min(1).max(YOUTUBE_TITLE_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .max(YOUTUBE_DESCRIPTION_MAX_LENGTH)
      .default(""),
    tags: tagsSchema,
    visibility: publicationVisibilitySchema,
    requestNonce: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.platform === "facebook" && value.visibility === "unlisted")
      context.addIssue({
        code: "custom",
        path: ["visibility"],
        message: "Facebook Page videos cannot use unlisted visibility.",
      });
  });

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
