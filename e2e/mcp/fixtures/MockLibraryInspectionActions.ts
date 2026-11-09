import { z } from "zod";
import { uploadedVideo } from "./social-draft-data";
export async function checkLibraryInspectionsAction(input: unknown) {
  z.array(z.uuid()).max(12).parse(input);
  localStorage.setItem(
    "inspection-check-count",
    String(Number(localStorage.getItem("inspection-check-count") ?? 0) + 1),
  );
  if (localStorage.getItem("inspection-status-error"))
    return {
      ok: false as const,
      error:
        "Worker status is temporarily unavailable. Try Check status again.",
    };
  const status = localStorage.getItem("inspection-result") ?? "pending";
  return {
    ok: true as const,
    assets: [
      {
        ...uploadedVideo,
        inspectionPending: status === "pending",
        inspectionFailed: status === "failed",
        inspectionError:
          status === "failed"
            ? "Verification ran out of memory. Retry using the saved original."
            : null,
      },
    ],
  };
}
export async function retryLibraryInspectionAction(input: unknown) {
  z.uuid().parse(input);
  localStorage.setItem(
    "inspection-retry-count",
    String(Number(localStorage.getItem("inspection-retry-count") ?? 0) + 1),
  );
  localStorage.setItem("inspection-result", "pending");
  return { ok: true as const, assets: [uploadedVideo] };
}
export async function updateMediaAssetAction() {
  return { ok: false as const, error: "Unused in this journey" };
}
export async function deleteMediaAssetAction() {
  return { ok: false as const, error: "Unused in this journey" };
}
