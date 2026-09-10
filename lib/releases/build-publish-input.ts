import type { PublishVideoInput } from "@/lib/schemas/publishing";
import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";

/**
 * Which platforms a release can be scheduled to.
 *
 * TikTok is deliberately excluded. Its flow delivers a video to the creator's
 * inbox for them to finish, and the existing publish path requires them to
 * confirm that consent at the moment of sending. Scheduling it would mean
 * recording consent now for a handover that happens later without anyone
 * present, which weakens the very record the consent exists to be. The
 * interface says so rather than hiding the option.
 */
export function canScheduleReleasePlatform(
  platform: VideoContentPlatform,
): boolean {
  return platform !== "tiktok";
}

export function describeUnschedulablePlatform(
  platform: VideoContentPlatform,
): string | null {
  if (platform !== "tiktok") return null;
  return "TikTok cannot be scheduled: it delivers to your inbox and needs your confirmation as it is sent. Send it when you are ready.";
}

/** The stored packaging a scheduled dispatch publishes. */
export interface ScheduledReleaseMetadata {
  platform: VideoContentPlatform;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  caption: string | null;
  shareToFeed: boolean | null;
}

export type BuildPublishInputResult =
  { ok: true; input: PublishVideoInput } | { ok: false; message: string };

/**
 * Turns a frozen release package into the request the publish path expects.
 *
 * Built from what was stored rather than from anything read at dispatch time,
 * so a release publishes the wording that was reviewed and confirmed, not
 * whatever the fields happen to say when the sweeper runs.
 *
 * `requestNonce` is the schedule's own id. It is deterministic on purpose: a
 * dispatch that is retried reuses the same idempotency key, so a release can
 * never be published twice because a sweep was repeated.
 */
export function buildScheduledPublishInput(input: {
  scheduleId: string;
  projectId: string;
  renderId: string;
  connectionId: string;
  metadata: ScheduledReleaseMetadata;
}): BuildPublishInputResult {
  const { metadata } = input;
  const base = {
    projectId: input.projectId,
    renderId: input.renderId,
    connectionId: input.connectionId,
    requestNonce: input.scheduleId,
  };

  if (!canScheduleReleasePlatform(metadata.platform))
    return {
      ok: false,
      message:
        describeUnschedulablePlatform(metadata.platform) ??
        "That platform cannot be scheduled.",
    };

  if (metadata.platform === "instagram") {
    if (metadata.caption === null || metadata.shareToFeed === null)
      return {
        ok: false,
        message: "This Instagram release has no saved caption.",
      };
    return {
      ok: true,
      input: {
        ...base,
        platform: "instagram",
        caption: metadata.caption,
        shareToFeed: metadata.shareToFeed,
        visibility: "public",
      },
    };
  }

  if (!metadata.title.trim())
    return { ok: false, message: "This release has no saved title." };

  if (metadata.platform === "facebook") {
    // Facebook accepts only these two; anything else was never a valid choice
    // for it, so refusing beats silently downgrading the creator's decision.
    if (metadata.visibility !== "private" && metadata.visibility !== "public")
      return {
        ok: false,
        message: "This release has a visibility Facebook does not accept.",
      };
    return {
      ok: true,
      input: {
        ...base,
        platform: "facebook",
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        visibility: metadata.visibility,
      },
    };
  }

  if (
    metadata.visibility !== "private" &&
    metadata.visibility !== "unlisted" &&
    metadata.visibility !== "public"
  )
    return {
      ok: false,
      message: "This release has a visibility YouTube does not accept.",
    };

  return {
    ok: true,
    input: {
      ...base,
      platform: "youtube",
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      visibility: metadata.visibility,
    },
  };
}
