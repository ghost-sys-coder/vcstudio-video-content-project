import { z } from "zod";
import { VIDEO_CONTENT_PLATFORMS } from "@/lib/platforms/video-content-platforms";

/**
 * What a browser is allowed to say about a release package.
 *
 * Bounds mirror the database's own checks so a rejection is a readable message
 * rather than a constraint violation, and the tag list is capped because it
 * arrives as free text from a form.
 */
export const saveReleasePackageSchema = z.object({
  projectId: z.uuid(),
  outputVariantId: z.uuid(),
  platform: z.enum(VIDEO_CONTENT_PLATFORMS),
  channelProfileId: z.uuid().nullable(),
  /** Null creates the package; a number is the revision being edited. */
  expectedRevision: z.coerce.number().int().min(1).nullable(),
  title: z.string().trim().max(300),
  titleSuggestionId: z.uuid().nullable(),
  description: z.string().max(10_000),
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
  visibility: z.enum(["private", "unlisted", "public", "platform_default"]),
  thumbnailGenerationId: z.uuid().nullable(),
  caption: z.string().max(4_000).nullable(),
  shareToFeed: z.boolean().nullable(),
  plannedReleaseAt: z.iso.datetime().nullable(),
});

export type SaveReleasePackageInput = z.infer<typeof saveReleasePackageSchema>;

export const confirmReleasePackageSchema = z.object({
  projectId: z.uuid(),
  releasePackageId: z.uuid(),
  renderId: z.uuid(),
  expectedRevision: z.coerce.number().int().min(1),
});

/** Parses the comma-separated tag field a form submits. */
export function parseReleaseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(",")) {
    // Trimmed before the hash is stripped: " #money" starts with a space, so
    // an anchored ^#+ would never match and the hash would survive.
    const tag = raw.trim().replace(/^#+/u, "").replace(/\s+/gu, " ").trim();
    if (tag === "" || tag.length > 60) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === 30) break;
  }
  return tags;
}
