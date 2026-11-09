import { z } from "zod";
import type { VideoThumbnailResult } from "@/lib/media/video-thumbnail-result";
import { legacyVideo, thumbnailVideo } from "./video-thumbnail-data";
const schema = z.object({ status: z.enum(["ready", "pending", "failed"]) });
async function call(path: string): Promise<VideoThumbnailResult> {
  const response = await fetch(path, { method: "POST" });
  if (!response.ok) throw new Error("Simulated request failure");
  const result = schema.parse(await response.json());
  if (result.status === "ready")
    return {
      status: "ready",
      asset: { ...legacyVideo, thumbnailUrl: thumbnailVideo.thumbnailUrl },
    };
  if (result.status === "pending")
    return { status: "pending", proof: "test-status-proof" };
  return {
    status: "failed",
    error:
      "The thumbnail could not be created. You can retry; the original video is still available.",
  };
}
export async function requestVideoThumbnailAction() {
  return call("/test-thumbnail-request");
}
export async function checkVideoThumbnailAction() {
  return call("/test-thumbnail-status");
}
