import "server-only";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { toMediaAssetView } from "@/lib/media/media-asset-view";
import { listSocialPostDraftConnectionIds } from "@/db/repositories/social-post-destinations.repository";

import type { SocialPostTarget } from "@/db/schema";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import {
  listSocialPostMedia,
  listSocialPostMediaSummaries,
  listSocialPostTargets,
  listSocialPostTargetsForPosts,
  listSocialPosts,
  findSocialPost,
} from "@/db/repositories/social-posts.repository";
import { isEditableStatus } from "@/db/commands/social-post-commands";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { isSocialPostPlatform } from "@/lib/social/platform-post-capabilities";
import {
  toPostAttachmentView,
  toSocialPostSummaryView,
  toSocialPostTargetView,
  type PostConnectionView,
  type SocialPostComposerView,
  type SocialPostSummaryView,
  type SocialPostTargetView,
} from "@/lib/social/social-post-view";
import { CONTENT_PLATFORM_LABELS } from "@/lib/titles/title-view";
import { platformConnectionLabel } from "@/lib/publishing/connection-label";
import { toVisualMediaKind } from "@/lib/media/visual-media-kind";

async function loadConnectionsByIdAndList(workspaceId: string): Promise<{
  byId: Map<string, PostConnectionView>;
  postable: PostConnectionView[];
}> {
  const connections = await listPlatformConnections({ workspaceId });
  const byId = new Map<string, PostConnectionView>();
  const postable: PostConnectionView[] = [];
  for (const connection of connections) {
    const view: PostConnectionView = {
      id: connection.id,
      platform: connection.platform,
      platformLabel: platformConnectionLabel(connection),
      accountName: connection.externalAccountName,
      status: connection.status,
    };
    byId.set(connection.id, view);
    // Only a platform this app can actually post to, and only a live
    // connection, is offerable as a destination.
    if (
      isSocialPostPlatform(connection.platform) &&
      connection.status === "active"
    )
      postable.push(view);
  }
  return { byId, postable };
}

function toTargetViews(
  targets: SocialPostTarget[],
  connectionsById: Map<string, PostConnectionView>,
): SocialPostTargetView[] {
  return targets.map((target) =>
    toSocialPostTargetView({
      target,
      platformLabel:
        connectionsById.get(target.connectionId)?.platformLabel ??
        CONTENT_PLATFORM_LABELS[target.platform],
      accountName:
        connectionsById.get(target.connectionId)?.accountName ??
        // A disconnected account keeps its history; the row survives because
        // `connection_id` is `on delete restrict`, but the projection may not
        // have a live summary for it.
        "Disconnected account",
    }),
  );
}

export async function loadSocialPostsView(input: {
  workspaceId: string;
  includePreviews?: boolean;
}): Promise<SocialPostSummaryView[]> {
  const posts = await listSocialPosts({ workspaceId: input.workspaceId });
  if (posts.length === 0) return [];

  const [{ byId }, targets, mediaByPost] = await Promise.all([
    loadConnectionsByIdAndList(input.workspaceId),
    listSocialPostTargetsForPosts({
      workspaceId: input.workspaceId,
      postIds: posts.map((post) => post.id),
    }),
    listSocialPostMediaSummaries({
      workspaceId: input.workspaceId,
      postIds: posts.map((post) => post.id),
      includePreviews: input.includePreviews,
    }),
  ]);

  const targetsByPost = new Map<string, SocialPostTarget[]>();
  for (const target of targets) {
    const existing = targetsByPost.get(target.postId);
    if (existing) existing.push(target);
    else targetsByPost.set(target.postId, [target]);
  }

  return Promise.all(
    posts.map(async (post) => {
      const media = mediaByPost.get(post.id);
      return toSocialPostSummaryView({
        post,
        targets: toTargetViews(targetsByPost.get(post.id) ?? [], byId),
        mediaCount: media?.mediaCount ?? 0,
        mediaPreviewUrl:
          input.includePreviews && media?.previewObjectKey
            ? await createMediaAssetDownloadUrl(media.previewObjectKey)
            : null,
        // Null for a sound file rather than a guess: the preview tile shows
        // an image or a video, and audio is not attachable to a post.
        mediaKind:
          input.includePreviews && media?.previewKind
            ? toVisualMediaKind(media.previewKind)
            : null,
      });
    }),
  );
}

export async function loadSocialPostComposerView(input: {
  workspaceId: string;
  postId: string;
}): Promise<SocialPostComposerView | null> {
  const post = await findSocialPost({
    workspaceId: input.workspaceId,
    postId: input.postId,
  });
  if (!post) return null;

  const [media, targets, connections, connectionIds, thumbnail] =
    await Promise.all([
      listSocialPostMedia({
        workspaceId: input.workspaceId,
        postId: post.id,
      }),
      listSocialPostTargets({
        workspaceId: input.workspaceId,
        postId: post.id,
      }),
      loadConnectionsByIdAndList(input.workspaceId),
      listSocialPostDraftConnectionIds(input),
      post.youtubeThumbnailAssetId
        ? findMediaAsset({
            workspaceId: input.workspaceId,
            mediaAssetId: post.youtubeThumbnailAssetId,
          })
        : null,
    ]);

  const attachments = await Promise.all(
    media.map(async (attachment) =>
      toPostAttachmentView(
        attachment,
        // An attachment whose file is gone has no key to sign; the view marks it
        // unavailable and the preview falls back rather than 403-ing.
        attachment.objectKey === "" ||
          attachment.inspectionPending ||
          attachment.inspectionFailed
          ? ""
          : await createMediaAssetDownloadUrl(attachment.objectKey),
        attachment.thumbnailObjectKey &&
          !attachment.inspectionPending &&
          !attachment.inspectionFailed
          ? await createMediaAssetDownloadUrl(attachment.thumbnailObjectKey)
          : undefined,
      ),
    ),
  );

  return {
    id: post.id,
    name: post.name,
    status: post.status,
    version: post.version,
    bodyDocument: post.bodyDocument,
    bodyPlainText: post.bodyPlainText,
    youtubeSettings: post.youtubeSettings,
    youtubeThumbnail:
      thumbnail && !thumbnail.deletedAt
        ? toMediaAssetView(
            thumbnail,
            await createMediaAssetDownloadUrl(thumbnail.objectKey),
          )
        : null,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    scheduledTimezone: post.scheduledTimezone,
    attachments,
    targets: toTargetViews(targets, connections.byId),
    connectionIds,
    availableConnections: [
      ...connections.postable,
      ...connectionIds
        .filter(
          (id) =>
            !connections.postable.some((connection) => connection.id === id),
        )
        .flatMap((id) => {
          const connection = connections.byId.get(id);
          return connection ? [connection] : [];
        }),
    ],
    editable: isEditableStatus(post.status),
  };
}
