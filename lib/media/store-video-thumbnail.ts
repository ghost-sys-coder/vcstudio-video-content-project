import "server-only";

import { videoThumbnailSchema } from "@studio/contracts/video";
import type { MediaInspectionResult } from "@/lib/media/media-inspection";
import { videoThumbnailObjectKey } from "@/lib/media/video-thumbnail";
import { putGeneratedMediaAsset } from "@/lib/storage/media-asset-storage";

export async function storeVideoThumbnail(input: {
  workspaceId: string;
  mediaAssetId: string;
  thumbnail: NonNullable<MediaInspectionResult["thumbnail"]>;
}) {
  const { bytes, ...descriptor } = input.thumbnail;
  const thumbnail = videoThumbnailSchema.parse({ version: 1, ...descriptor });
  await putGeneratedMediaAsset({
    objectKey: videoThumbnailObjectKey(input),
    bytes,
    contentType: "image/jpeg",
  });
  return thumbnail;
}
