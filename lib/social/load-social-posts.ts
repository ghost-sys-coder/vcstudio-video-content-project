import "server-only";

import type { SocialPostTarget } from "@/db/schema";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import {
  listSocialPostMedia,
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
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
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
      platformLabel: CONTENT_PLATFORM_LABELS[target.platform],
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
}): Promise<SocialPostSummaryView[]> {
  const posts = await listSocialPosts({ workspaceId: input.workspaceId });
  if (posts.length === 0) return [];

  const [{ byId }, targets] = await Promise.all([
    loadConnectionsByIdAndList(input.workspaceId),
    listSocialPostTargetsForPosts({
      workspaceId: input.workspaceId,
      postIds: posts.map((post) => post.id),
    }),
  ]);

  const targetsByPost = new Map<string, SocialPostTarget[]>();
  for (const target of targets) {
    const existing = targetsByPost.get(target.postId);
    if (existing) existing.push(target);
    else targetsByPost.set(target.postId, [target]);
  }

  // Attachment counts come from the per-post media lookup rather than a join,
  // because the list only needs a count and the page size is bounded.
  const mediaByPost = await Promise.all(
    posts.map(
      async (post) =>
        await listSocialPostMedia({
          workspaceId: input.workspaceId,
          postId: post.id,
        }),
    ),
  );

  return Promise.all(
    posts.map(async (post, index) => {
      const media = mediaByPost[index] ?? [];
      const first = media.find(
        (attachment) => !attachment.unavailable && attachment.objectKey !== "",
      );
      return toSocialPostSummaryView({
        post,
        targets: toTargetViews(targetsByPost.get(post.id) ?? [], byId),
        mediaCount: media.length,
        mediaPreviewUrl: first
          ? await createMediaAssetDownloadUrl(first.objectKey)
          : null,
        mediaKind: first?.kind ?? null,
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

  const [media, targets, connections] = await Promise.all([
    listSocialPostMedia({
      workspaceId: input.workspaceId,
      postId: post.id,
    }),
    listSocialPostTargets({
      workspaceId: input.workspaceId,
      postId: post.id,
    }),
    loadConnectionsByIdAndList(input.workspaceId),
  ]);

  const attachments = await Promise.all(
    media.map(async (attachment) =>
      toPostAttachmentView(
        attachment,
        // An attachment whose file is gone has no key to sign; the view marks it
        // unavailable and the preview falls back rather than 403-ing.
        attachment.objectKey === ""
          ? ""
          : await createMediaAssetDownloadUrl(attachment.objectKey),
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
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    scheduledTimezone: post.scheduledTimezone,
    attachments,
    targets: toTargetViews(targets, connections.byId),
    availableConnections: connections.postable,
    editable: isEditableStatus(post.status),
  };
}
