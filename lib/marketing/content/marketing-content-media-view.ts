import "server-only";

import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { listMarketingContentMedia } from "@/db/repositories/marketing-content.repository";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export async function loadMarketingContentMediaView(input: {
  workspaceId: string;
  contentItemId: string;
}): Promise<MediaAssetView[]> {
  const attachments = await listMarketingContentMedia(input);
  const assets = await findReadyMediaAssets({
    workspaceId: input.workspaceId,
    mediaAssetIds: attachments.map((attachment) => attachment.mediaAssetId),
  });
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return Promise.all(
    attachments.flatMap((attachment) => {
      const asset = assetsById.get(attachment.mediaAssetId);
      if (!asset) return [];
      return [
        createMediaAssetDownloadUrl(asset.objectKey).then((previewUrl) =>
          toMediaAssetView(asset, previewUrl),
        ),
      ];
    }),
  );
}
