import "server-only";
import { tasks } from "@trigger.dev/sdk";
import {
  findSocialPost,
  listSocialPostTargets,
} from "@/db/repositories/social-posts.repository";
import { recordSocialYouTubeThumbnail } from "@/db/commands/social-post-target-commands";
import { getPublishingEnvironment } from "@/lib/env/server";
import { validateYouTubePost } from "./validate-youtube-post";
import type { socialPostPublishTask } from "@/trigger/social-post-publish";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
export class YouTubeThumbnailRetryError extends Error {}

export async function retrySocialYouTubeThumbnail(input: {
  workspaceId: string;
  postId: string;
  connectionId: string;
  expectedVersion: number;
  requestNonce: string;
  mcpOperationId?: string;
}) {
  if (!getPublishingEnvironment().ENABLE_SOCIAL_POSTING)
    throw new YouTubeThumbnailRetryError("Social publishing is disabled.");
  const post = await findSocialPost(input);
  if (
    !post ||
    post.version !== input.expectedVersion ||
    (post.mcpOperationId && post.mcpOperationId !== input.mcpOperationId)
  )
    throw new YouTubeThumbnailRetryError(
      "This post changed. Read it again before retrying the thumbnail.",
    );
  const target = (await listSocialPostTargets(input)).find(
    (t) => t.connectionId === input.connectionId,
  );
  if (
    !target ||
    target.platform !== "youtube" ||
    target.status !== "published" ||
    !target.externalPostId ||
    !target.youtubeThumbnailAssetId ||
    target.youtubeThumbnailStatus === "succeeded"
  )
    throw new YouTubeThumbnailRetryError(
      "That destination has no unfinished YouTube thumbnail to retry.",
    );
  await validateYouTubePost({
    workspaceId: input.workspaceId,
    settings: target.youtubeSettings,
    thumbnailAssetId: target.youtubeThumbnailAssetId,
    text: post.bodyPlainText,
  });
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "social_post_publication",
  });
  await recordSocialYouTubeThumbnail({
    workspaceId: input.workspaceId,
    targetId: target.id,
    state: "pending",
    detail: null,
  });
  try {
    const run = await tasks.trigger<typeof socialPostPublishTask>(
      "social-post-publish",
      { workspaceId: input.workspaceId, postId: post.id, targetId: target.id },
      {
        idempotencyKey: `youtube-thumbnail:${target.id}:${input.requestNonce}`,
      },
    );
    return {
      targetId: target.id,
      runId: run.id,
      videoId: target.externalPostId,
    };
  } catch {
    await recordSocialYouTubeThumbnail({
      workspaceId: input.workspaceId,
      targetId: target.id,
      state: "failed",
      detail: "The thumbnail retry could not be queued. Try again.",
    });
    throw new YouTubeThumbnailRetryError(
      "The thumbnail retry could not be queued. Try again.",
    );
  }
}
