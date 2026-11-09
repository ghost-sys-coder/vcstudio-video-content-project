import type { MediaAsset } from "@/db/schema";
import { mediaAvailability } from "@/lib/media/media-availability";

export function videoThumbnailObjectKey(input: {
  workspaceId: string;
  mediaAssetId: string;
}): string {
  return `workspaces/${input.workspaceId}/library/${input.mediaAssetId}/poster-v1.jpg`;
}

/** Recognize only our canonical derivative keys so cleanup can use indexed IDs. */
export function videoThumbnailReference(objectKey: string) {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const match = new RegExp(
    `^workspaces/(${uuid})/library/(${uuid})/poster-v1\\.jpg$`,
  ).exec(objectKey);
  return match ? { workspaceId: match[1], mediaAssetId: match[2] } : null;
}

/** Derived from trusted records; no storage key is accepted from a browser. */
export function mediaAssetThumbnailKey(
  asset: Pick<
    MediaAsset,
    | "id"
    | "workspaceId"
    | "kind"
    | "status"
    | "inspectionStatus"
    | "verifiedMetadata"
  >,
): string | null {
  return asset.kind === "video" &&
    mediaAvailability(asset).ready &&
    asset.verifiedMetadata?.kind === "video" &&
    asset.verifiedMetadata.thumbnail?.version === 1
    ? videoThumbnailObjectKey({
        workspaceId: asset.workspaceId,
        mediaAssetId: asset.id,
      })
    : null;
}
