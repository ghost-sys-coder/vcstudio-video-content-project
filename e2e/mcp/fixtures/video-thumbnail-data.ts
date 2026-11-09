import type { MediaAssetView } from "@/lib/media/media-asset-view";
export const thumbnailVideo: MediaAssetView = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "video",
  title: "Video with preview",
  altText: "",
  tags: [],
  contentType: "video/mp4",
  sizeBytes: 1000,
  width: 1920,
  height: 1080,
  durationMilliseconds: 8000,
  originalFileName: "video.mp4",
  createdAt: "2026-11-09T00:00:00Z",
  previewUrl: "/test-private-video.mp4",
  thumbnailUrl: "/test-video-poster.jpg",
};
export const legacyVideo: MediaAssetView = {
  ...thumbnailVideo,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Existing video",
  thumbnailUrl: undefined,
};
