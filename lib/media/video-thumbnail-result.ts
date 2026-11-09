import type { MediaAssetView } from "@/lib/media/media-asset-view";

export type VideoThumbnailResult =
  | { status: "ready"; asset: MediaAssetView }
  | { status: "pending"; proof: string }
  | { status: "failed"; error: string };
