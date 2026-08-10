import "server-only";

import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { isRepublishableStatus } from "@/db/commands/social-post-commands";
import {
  createSocialPostTargets,
  markSocialPostPublishing,
  markSocialPostTargetFailed,
  markSocialPostTargetQueued,
  replaceSocialPostTargets,
} from "@/db/commands/social-post-target-commands";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { findPlatformConnectionSummary } from "@/db/repositories/publishing.repository";
import {
  findSocialPost,
  listSocialPostMedia,
  listSocialPostTargets,
} from "@/db/repositories/social-posts.repository";
import { createSocialPostTargetIdempotencyKey } from "@/lib/domain/idempotency";
import {
  getPublishingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { isSocialPostPlatformConfigured } from "@/lib/publishing/social-post-registry";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  isSocialPostPlatform,
  type SocialPostPlatform,
} from "@/lib/social/platform-post-capabilities";
import {
  checkPlatformEligibility,
  summarizeAttachments,
} from "@/lib/social/select-eligible-platforms";
import { checkVerifiedVideoCompatibility } from "@/lib/social/video-platform-compatibility";
import type { socialPostPublishTask } from "@/trigger/social-post-publish";

export class SocialPostPublicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialPostPublicationError";
  }
}

/**
 * Validate a publish request end to end, then dispatch one durable job per
 * destination.
 *
 * Everything knowable before touching a platform is checked here: the post has
 * content, every connection is live and belongs to this workspace, every
 * attachment is still a usable library asset, and the **same capability matrix
 * the composer used** accepts each destination. Re-running that pure check
 * server-side is the point — the browser's version of it is a convenience, not
 * an authority.
 *
 * One job per target rather than one per post, so a LinkedIn success and an
 * Instagram rejection are independent outcomes with independent retries.
 */
export async function startSocialPostPublication(input: {
  workspaceId: string;
  postId: string;
  connectionIds: string[];
  requestNonce: string;
  captionOverrides?: { platform: SocialPostPlatform; text: string }[];
}): Promise<{ dispatched: number }> {
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_SOCIAL_POSTING)
    throw new SocialPostPublicationError("Posting is disabled.");
  if (input.connectionIds.length === 0)
    throw new SocialPostPublicationError("Choose at least one destination.");

  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "social_post_publication",
  });

  const post = await findSocialPost({
    workspaceId: input.workspaceId,
    postId: input.postId,
  });
  if (!post)
    throw new SocialPostPublicationError("That post no longer exists.");
  if (!isRepublishableStatus(post.status))
    throw new SocialPostPublicationError(
      "This post has already been sent or is on its way.",
    );

  const media = await listSocialPostMedia({
    workspaceId: input.workspaceId,
    postId: post.id,
  });
  // `unavailable` already covers a removed library asset and a render whose
  // output is gone; the library lookup additionally rejects anything still
  // uploading, which is not a state `unavailable` distinguishes.
  if (media.some((attachment) => attachment.unavailable))
    throw new SocialPostPublicationError(
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
    throw new SocialPostPublicationError(
      "An attached file is no longer available. Remove it and try again.",
    );

  const attachments = summarizeAttachments(
    media.map((attachment) => attachment.kind),
  );

  const resolved: {
    platform: SocialPostPlatform;
    connectionId: string;
    idempotencyKey: string;
    overrideBodyPlainText: string | null;
  }[] = [];

  const captionOverrides = new Map(
    (input.captionOverrides ?? []).map((entry) => [entry.platform, entry.text]),
  );

  const bodyFingerprint = createHash("sha256")
    .update(post.bodyPlainText)
    .update("\0")
    .update(
      media
        .map((attachment) => `${attachment.source}:${attachment.sourceId}`)
        .join(","),
    )
    .digest("hex");

  for (const connectionId of new Set(input.connectionIds)) {
    const connection = await findPlatformConnectionSummary({
      workspaceId: input.workspaceId,
      connectionId,
    });
    if (!connection || connection.status !== "active")
      throw new SocialPostPublicationError(
        "Reconnect that account before posting to it.",
      );
    if (!isSocialPostPlatform(connection.platform))
      throw new SocialPostPublicationError(
        "Posting to that platform is not available yet.",
      );
    // Fail fast with a clear message rather than dispatching a job that would
    // crash in the worker for a missing server credential.
    if (!isSocialPostPlatformConfigured(connection.platform))
      throw new SocialPostPublicationError(
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
      throw new SocialPostPublicationError(eligibility.reason);
    for (const video of readyAssets.filter((asset) => asset.kind === "video")) {
      const compatibility = checkVerifiedVideoCompatibility({
        platform: connection.platform,
        metadata: video.verifiedMetadata,
      });
      if (!compatibility.compatible)
        throw new SocialPostPublicationError(compatibility.reason);
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

  const existing = await listSocialPostTargets({
    workspaceId: input.workspaceId,
    postId: post.id,
  });
  // A target that already published must survive — its external id is the only
  // record that the post exists on that platform. It is also skipped rather
  // than recreated, both to avoid posting twice and because the
  // (post, connection) unique index would reject the duplicate row anyway.
  const alreadyPublished = new Set(
    existing
      .filter((target) => target.status === "published")
      .map((target) => target.connectionId),
  );
  const targets = await replaceSocialPostTargets({
    workspaceId: input.workspaceId,
    postId: post.id,
    targets: resolved.filter(
      (entry) => !alreadyPublished.has(entry.connectionId),
    ),
  });

  if (targets.length === 0)
    throw new SocialPostPublicationError(
      "Every chosen destination has already received this post.",
    );

  await markSocialPostPublishing({
    workspaceId: input.workspaceId,
    postId: post.id,
  });

  let dispatched = 0;
  for (const target of targets) {
    try {
      const handle = await tasks.trigger<typeof socialPostPublishTask>(
        "social-post-publish",
        {
          targetId: target.id,
          postId: post.id,
          workspaceId: input.workspaceId,
        },
        { idempotencyKey: target.idempotencyKey },
      );
      await markSocialPostTargetQueued({
        targetId: target.id,
        triggerRunId: handle.id,
      });
      dispatched += 1;
    } catch {
      // One destination failing to queue must not abandon the others.
      await markSocialPostTargetFailed({
        targetId: target.id,
        category: "dispatch_failed",
        message: "This destination could not be queued.",
      });
    }
  }

  if (dispatched === 0)
    throw new SocialPostPublicationError("Publishing could not be queued.");

  return { dispatched };
}

/** Re-exported for the composer's create path, which needs the same shape. */
export { createSocialPostTargets };
