import "server-only";

import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { saveMediaAssetThumbnail } from "@/db/commands/media-inspection-commands";
import {
  getSceneAudioEnvironment,
  getMediaLibraryEnvironment,
} from "@/lib/env/server";
import { inspectMediaFile } from "@/lib/media/inspect-media-file";
import { mediaAvailability } from "@/lib/media/media-availability";
import { mediaAssetThumbnailKey } from "@/lib/media/video-thumbnail";
import { storeVideoThumbnail } from "@/lib/media/store-video-thumbnail";
import { downloadMediaAssetBytes } from "@/lib/storage/media-asset-storage";

export async function runMediaAssetThumbnail(input: {
  workspaceId: string;
  mediaAssetId: string;
}) {
  const asset = await findMediaAsset(input);
  if (
    !asset ||
    asset.deletedAt ||
    asset.kind !== "video" ||
    !mediaAvailability(asset).ready
  )
    return { status: "failed" as const };
  if (mediaAssetThumbnailKey(asset)) return { status: "succeeded" as const };
  try {
    const environment = getSceneAudioEnvironment();
    if (
      asset.sizeBytes <= 0 ||
      asset.sizeBytes > getMediaLibraryEnvironment().MAX_MEDIA_VIDEO_BYTES
    )
      throw new Error("VIDEO_THUMBNAIL_SOURCE_SIZE_INVALID");
    const bytes = await downloadMediaAssetBytes(asset.objectKey);
    if (bytes.byteLength !== asset.sizeBytes)
      throw new Error("VIDEO_THUMBNAIL_SOURCE_SIZE_CHANGED");
    const result = await inspectMediaFile({
      bytes,
      extension:
        asset.contentType === "video/webm"
          ? "webm"
          : asset.contentType === "video/quicktime"
            ? "mov"
            : "mp4",
      expectedKind: "video",
      ffprobePath: environment.FFPROBE_PATH,
      ffmpegPath: environment.FFMPEG_PATH,
      createThumbnail: true,
    });
    if (!result.thumbnail || result.metadata.kind !== "video")
      throw new Error("VIDEO_THUMBNAIL_UNAVAILABLE");
    const thumbnail = await storeVideoThumbnail({
      ...input,
      thumbnail: result.thumbnail,
    });
    const saved = await saveMediaAssetThumbnail({
      ...input,
      thumbnail,
      metadata: result.metadata,
    });
    return { status: saved ? ("succeeded" as const) : ("failed" as const) };
  } catch {
    console.warn("Media library video thumbnail could not be created.");
    return { status: "failed" as const };
  }
}
