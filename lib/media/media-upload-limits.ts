import type { MediaAssetKind } from "@/db/schema";
import { formatBytes } from "@/lib/format/bytes";

export type MediaUploadLimits = {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxVideoDurationSeconds: number;
};

export type MediaUploadCheck =
  { allowed: true } | { allowed: false; reason: string };

/**
 * Pre-flight for a library upload, before any signed URL is minted.
 *
 * Pure and environment-free so both the authorize route and the completion route
 * can apply exactly the same rules — completion re-checks because the size the
 * browser promised at authorize time is not the size it actually uploaded.
 *
 * Duration is a client-reported hint (the web runtime has no ffprobe), so an
 * absent duration is accepted rather than rejected. Each platform enforces its
 * own real duration rules at publish time.
 */
export function checkMediaUpload(input: {
  kind: MediaAssetKind;
  sizeBytes: number;
  durationMilliseconds: number | null;
  limits: MediaUploadLimits;
}): MediaUploadCheck {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0)
    return { allowed: false, reason: "That file is empty." };

  const maximumBytes =
    input.kind === "image"
      ? input.limits.maxImageBytes
      : input.limits.maxVideoBytes;
  if (input.sizeBytes > maximumBytes)
    return {
      allowed: false,
      reason: `That ${input.kind} is ${formatBytes(input.sizeBytes)}. The limit is ${formatBytes(maximumBytes)}.`,
    };

  if (
    input.kind === "video" &&
    input.durationMilliseconds !== null &&
    input.durationMilliseconds > input.limits.maxVideoDurationSeconds * 1000
  )
    return {
      allowed: false,
      reason: `That video is longer than the ${Math.round(input.limits.maxVideoDurationSeconds / 60)} minute limit.`,
    };

  return { allowed: true };
}
