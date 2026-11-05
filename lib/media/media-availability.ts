import type { MediaAsset } from "@/db/schema";

/** Legacy ready videos without an inspection state remain usable. */
export function mediaAvailability(
  asset: Pick<MediaAsset, "kind" | "status" | "inspectionStatus">,
) {
  const inspectionFailed =
    asset.status === "failed" ||
    (asset.kind === "video" && asset.inspectionStatus === "failed");
  const inspectionPending =
    !inspectionFailed &&
    asset.kind === "video" &&
    (asset.status === "pending" ||
      asset.inspectionStatus === "pending" ||
      asset.inspectionStatus === "running");
  return {
    inspectionFailed,
    inspectionPending,
    ready: asset.status === "ready" && !inspectionFailed && !inspectionPending,
  };
}
