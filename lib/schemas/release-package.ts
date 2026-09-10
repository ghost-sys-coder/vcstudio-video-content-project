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
  /**
   * The creator's own declarations. Null means not answered yet, which is
   * deliberately different from answered no.
   */
  madeForKids: z.boolean().nullable().default(null),
  containsSyntheticMedia: z.boolean().nullable().default(null),
  /** Optional playlist to add the published video to, where permitted. */
  youtubePlaylistId: z.string().trim().max(64).nullable().default(null),
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

/** Scheduling one release. The wall-clock time and its zone, never an instant. */
export const scheduleReleaseSchema = z.object({
  projectId: z.uuid(),
  releasePackageId: z.uuid(),
  renderId: z.uuid(),
  connectionId: z.uuid(),
  /** `YYYY-MM-DDTHH:mm`, exactly as `<input type="datetime-local">` gives it. */
  localDateTime: z.string().min(1).max(32),
  /** An IANA zone name. Validated against the platform's own zone database. */
  timeZone: z.string().min(1).max(64),
});

export const cancelReleaseScheduleSchema = z.object({
  projectId: z.uuid(),
  scheduleId: z.uuid(),
});

export type ScheduleReleaseInput = z.infer<typeof scheduleReleaseSchema>;
