import type { MediaAsset, MediaAssetKind } from "@/db/schema";
import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";

/**
 * The client-safe projection of a library asset.
 *
 * Deliberately omits `objectKey`, `workspaceId`, and `uploadedByUserId`: the
 * browser never needs the storage key (it gets a short-lived signed URL instead),
 * and leaking keys would let a client probe the bucket's layout. Dates are ISO
 * strings so this crosses the server/client boundary unchanged.
 */
export type MediaAssetView = {
  id: string;
  kind: MediaAssetKind;
  title: string;
  altText: string;
  tags: string[];
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMilliseconds: number | null;
  verifiedMetadata?: VerifiedMediaMetadata | null;
  inspectionWarnings?: string[];
  originalFileName: string;
  createdAt: string;
  /** Short-lived signed R2 URL. Regenerated on every page load; never stored. */
  previewUrl: string;
};

export function toMediaAssetView(
  asset: MediaAsset,
  previewUrl: string,
): MediaAssetView {
  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title.trim() === "" ? asset.originalFileName : asset.title,
    altText: asset.altText,
    tags: asset.tags,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationMilliseconds: asset.durationMilliseconds,
    verifiedMetadata: asset.verifiedMetadata,
    inspectionWarnings: asset.inspectionWarnings,
    originalFileName: asset.originalFileName,
    createdAt: asset.createdAt.toISOString(),
    previewUrl,
  };
}
