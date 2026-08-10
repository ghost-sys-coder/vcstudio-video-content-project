import "server-only";

import { createHash } from "node:crypto";
import {
  cancelSocialPostSchedule,
  scheduleSocialPost,
} from "@/db/commands/social-post-schedule-commands";
import { isRepublishableStatus } from "@/db/commands/social-post-commands";
import { replaceSocialPostTargets } from "@/db/commands/social-post-target-commands";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { findPlatformConnectionSummary } from "@/db/repositories/publishing.repository";
import {
  findSocialPost,
  listSocialPostMedia,
} from "@/db/repositories/social-posts.repository";
import { createSocialPostTargetIdempotencyKey } from "@/lib/domain/idempotency";
import {
  getPublishingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { isSocialPostPlatformConfigured } from "@/lib/publishing/social-post-registry";
import {
  isSocialPostPlatform,
  type SocialPostPlatform,
} from "@/lib/social/platform-post-capabilities";
import { checkScheduleInstant } from "@/lib/social/schedule-window";
import {
  checkPlatformEligibility,
  summarizeAttachments,
} from "@/lib/social/select-eligible-platforms";
import { checkVerifiedVideoCompatibility } from "@/lib/social/video-platform-compatibility";

export class SocialPostScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialPostScheduleError";
  }
}

/**
 * Validates and stores a schedule.
 *
 * Target rows are created **now**, at schedule time, rather than when the sweeper
 * fires. Two reasons: the destinations are validated against the same capability
 * matrix while the author is still present to fix a problem, and the sweeper's
 * job stays trivial — claim, dispatch what is already there. A scheduled post
 * that will be rejected by Instagram should say so today, not silently fail at
 * 6am on Thursday.
 */
export async function scheduleSocialPostPublication(input: {
  workspaceId: string;
  postId: string;
  scheduledAt: Date;
  timezone: string;
  connectionIds: string[];
  requestNonce: string;
  captionOverrides?: { platform: SocialPostPlatform; text: string }[];
  now?: Date;
}): Promise<{ scheduledAt: Date }> {
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_SOCIAL_POSTING)
    throw new SocialPostScheduleError("Posting is disabled.");

  const instant = checkScheduleInstant({
    scheduledAt: input.scheduledAt,
    now: input.now,
  });
  if (!instant.valid) throw new SocialPostScheduleError(instant.reason);

  const post = await findSocialPost({
    workspaceId: input.workspaceId,
    postId: input.postId,
  });
  if (!post) throw new SocialPostScheduleError("That post no longer exists.");
  if (!isRepublishableStatus(post.status))
    throw new SocialPostScheduleError(
      "This post has already been sent or is on its way.",
    );

  const media = await listSocialPostMedia({
    workspaceId: input.workspaceId,
    postId: post.id,
  });
  if (media.some((attachment) => attachment.unavailable))
    throw new SocialPostScheduleError(
      "An attached file is no longer available. Remove it and try again.",
    );
  const libraryAttachments = media.filter(
    (attachment) => attachment.source === "library",
  );
  const readyAssets = await findReadyMediaAssets({
    workspaceId: input.workspaceId,
    mediaAssetIds: libraryAttachments.map((attachment) => attachment.sourceId),
  });
  if (readyAssets.length !== libraryAttachments.length)
    throw new SocialPostScheduleError(
      "An attached file is no longer available. Remove it and try again.",
    );

  const attachments = summarizeAttachments(
    media.map((attachment) => attachment.kind),
  );
  const bodyFingerprint = createHash("sha256")
    .update(post.bodyPlainText)
    .update(" ")
    .update(
      media
        .map((attachment) => `${attachment.source}:${attachment.sourceId}`)
        .join(","),
    )
    .digest("hex");
  const captionOverrides = new Map(
    (input.captionOverrides ?? []).map((entry) => [entry.platform, entry.text]),
  );

  const resolved = [];
  for (const connectionId of new Set(input.connectionIds)) {
    const connection = await findPlatformConnectionSummary({
      workspaceId: input.workspaceId,
      connectionId,
    });
    if (!connection || connection.status !== "active")
      throw new SocialPostScheduleError(
        "Reconnect that account before scheduling to it.",
      );
    if (!isSocialPostPlatform(connection.platform))
      throw new SocialPostScheduleError(
        "Posting to that platform is not available yet.",
      );
    if (!isSocialPostPlatformConfigured(connection.platform))
      throw new SocialPostScheduleError(
        "That platform isn't configured on the server yet. Contact an administrator.",
      );

    const override = captionOverrides.get(connection.platform);
    const platformText = override ?? post.bodyPlainText;
    const eligibility = checkPlatformEligibility({
      platform: connection.platform,
      attachments,
      plainTextLength: platformText.length,
    });
    if (!eligibility.eligible)
      throw new SocialPostScheduleError(eligibility.reason);
    for (const video of readyAssets.filter((asset) => asset.kind === "video")) {
      const compatibility = checkVerifiedVideoCompatibility({
        platform: connection.platform,
        metadata: video.verifiedMetadata,
      });
      if (!compatibility.compatible)
        throw new SocialPostScheduleError(compatibility.reason);
    }

    resolved.push({
      platform: connection.platform,
      connectionId,
      overrideBodyPlainText:
        override !== undefined && override !== post.bodyPlainText
          ? override
          : null,
      idempotencyKey: createSocialPostTargetIdempotencyKey({
        secret: getSceneAnalysisEnvironment().IDEMPOTENCY_HASH_SECRET,
        workspaceId: input.workspaceId,
        postId: post.id,
        connectionId,
        platform: connection.platform,
        bodyFingerprint: createHash("sha256")
          .update(bodyFingerprint)
          .update(platformText)
          .digest("hex"),
        requestNonce: input.requestNonce,
      }),
    });
  }

  await replaceSocialPostTargets({
    workspaceId: input.workspaceId,
    postId: post.id,
    targets: resolved,
  });

  const scheduled = await scheduleSocialPost({
    workspaceId: input.workspaceId,
    postId: post.id,
    scheduledAt: instant.scheduledAt,
    timezone: input.timezone,
  });
  if (!scheduled)
    throw new SocialPostScheduleError("That post could not be scheduled.");

  return { scheduledAt: instant.scheduledAt };
}

export async function cancelSocialPostPublication(input: {
  workspaceId: string;
  postId: string;
}): Promise<void> {
  const result = await cancelSocialPostSchedule({
    workspaceId: input.workspaceId,
    postId: input.postId,
  });
  if (!result.cancelled)
    throw new SocialPostScheduleError(
      "Only a scheduled post can be unscheduled.",
    );
}
