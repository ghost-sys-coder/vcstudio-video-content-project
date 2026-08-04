import "server-only";
import { createSocialPostForContentItem } from "@/db/commands/social-post-commands";
import {
  findMarketingContentItem,
  listMarketingContentMedia,
} from "@/db/repositories/marketing-content.repository";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

export class MarketingContentHandoffError extends Error {}
const HANDOFF_KINDS = new Set(["social_post", "graphic", "media_story"]);

export async function createPostFromContentItem(input: {
  workspaceId: string;
  contentItemId: string;
  createdByUserId: string;
}): Promise<{ postId: string }> {
  if (!getPublishingEnvironment().ENABLE_SOCIAL_POSTING)
    throw new MarketingContentHandoffError("Posting is disabled.");
  const item = await findMarketingContentItem(input);
  if (!item || item.status !== "approved")
    throw new MarketingContentHandoffError(
      "Only approved content can be handed off.",
    );
  if (!HANDOFF_KINDS.has(item.kind))
    throw new MarketingContentHandoffError("This content type is export-only.");
  if (item.socialPostId)
    throw new MarketingContentHandoffError(
      "This content was already handed off.",
    );
  const media = await listMarketingContentMedia(input);
  const assetIds = media.map((row) => row.mediaAssetId);
  const ready = await findReadyMediaAssets({
    workspaceId: input.workspaceId,
    mediaAssetIds: assetIds,
  });
  if (ready.length !== assetIds.length)
    throw new MarketingContentHandoffError(
      "One or more attached assets are unavailable.",
    );
  const post = await createSocialPostForContentItem({
    workspaceId: input.workspaceId,
    contentItemId: item.id,
    name: item.title,
    createdByUserId: input.createdByUserId,
    bodyDocument: item.bodyDocument,
    bodyPlainText: renderPortableDocumentToPlainText(item.bodyDocument),
    mediaAssetIds: assetIds,
  });
  return { postId: post.id };
}
