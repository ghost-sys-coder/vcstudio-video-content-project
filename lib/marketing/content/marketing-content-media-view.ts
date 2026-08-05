import "server-only";

import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { listMarketingContentMediaForItems } from "@/db/repositories/marketing-content.repository";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export async function loadMarketingContentMediaView(input: {
  workspaceId: string;
  contentItemId: string;
}): Promise<MediaAssetView[]> {
  const views = await loadMarketingContentMediaViews({
    workspaceId: input.workspaceId,
    contentItemIds: [input.contentItemId],
  });
  return views[input.contentItemId] ?? [];
}

export async function loadMarketingContentMediaViews(input: {
  workspaceId: string;
  contentItemIds: string[];
}): Promise<Record<string, MediaAssetView[]>> {
  const attachments = await listMarketingContentMediaForItems(input);
  const assets = await findReadyMediaAssets({
    workspaceId: input.workspaceId,
    mediaAssetIds: attachments.map((attachment) => attachment.mediaAssetId),
  });
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const resolved = await Promise.all(
    attachments.flatMap((attachment) => {
      const asset = assetsById.get(attachment.mediaAssetId);
      if (!asset) return [];
      return [
        createMediaAssetDownloadUrl(asset.objectKey).then(
          (previewUrl) =>
            [
              attachment.contentItemId,
              toMediaAssetView(asset, previewUrl),
            ] as const,
        ),
      ];
    }),
  );

  const views = Object.fromEntries(
    input.contentItemIds.map((contentItemId) => [contentItemId, []]),
  ) as Record<string, MediaAssetView[]>;
  for (const [contentItemId, asset] of resolved)
    views[contentItemId]?.push(asset);
  return views;
}
