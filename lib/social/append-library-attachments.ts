import type { MediaAssetView } from "@/lib/media/media-asset-view";
import type { PostAttachmentView } from "@/lib/social/social-post-view";

export function appendLibraryAttachments(
  current: PostAttachmentView[],
  assets: MediaAssetView[],
): PostAttachmentView[] {
  const ids = new Set(
    current
      .filter((item) => item.source === "library")
      .map((item) => item.asset.id),
  );
  return [
    ...current,
    ...assets
      .filter((asset) => !ids.has(asset.id))
      .map((asset) => ({
        asset,
        source: "library" as const,
        unavailable: Boolean(asset.inspectionPending || asset.inspectionFailed),
      })),
  ];
}
