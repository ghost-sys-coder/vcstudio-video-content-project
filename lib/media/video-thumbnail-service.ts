import "server-only";

import { tasks, runs } from "@trigger.dev/sdk";
import { z } from "zod";
import { requestVideoThumbnailSchema } from "@studio/contracts/video";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingEnvironment } from "@/lib/env/server";
import { sealSecret, openSecret } from "@/lib/crypto/secret-box";
import { can } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { mediaAvailability } from "@/lib/media/media-availability";
import { mediaAssetThumbnailKey } from "@/lib/media/video-thumbnail";
import { toMediaAssetView } from "@/lib/media/media-asset-view";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import type { VideoThumbnailResult } from "@/lib/media/video-thumbnail-result";
import type { mediaInspectionTask } from "@/trigger/media-inspection";

const proofSchema = z.object({
  purpose: z.literal("video-thumbnail-v1"),
  workspaceId: z.uuid(),
  userId: z.uuid(),
  mediaAssetId: z.uuid(),
  runId: z.string().min(1).max(256),
  expiresAt: z.number().int(),
});

async function authorizedAsset(mediaAssetId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageMediaLibrary"))
    throw new Error("THUMBNAIL_ACCESS_DENIED");
  const asset = await findMediaAsset({
    workspaceId: context.activeMembership.workspaceId,
    mediaAssetId,
  });
  if (
    !asset ||
    asset.deletedAt ||
    asset.kind !== "video" ||
    !mediaAvailability(asset).ready
  )
    throw new Error("THUMBNAIL_ASSET_UNAVAILABLE");
  return { asset, context };
}

async function readyResult(
  asset: Awaited<ReturnType<typeof authorizedAsset>>["asset"],
): Promise<VideoThumbnailResult | null> {
  const key = mediaAssetThumbnailKey(asset);
  if (!key) return null;
  const [preview, thumbnail] = await Promise.all([
    createMediaAssetDownloadUrl(asset.objectKey),
    createMediaAssetDownloadUrl(key),
  ]);
  return {
    status: "ready",
    asset: toMediaAssetView(asset, preview, thumbnail),
  };
}

export async function requestVideoThumbnail(
  input: unknown,
): Promise<VideoThumbnailResult> {
  try {
    const parsed = requestVideoThumbnailSchema.parse(input);
    const { asset, context } = await authorizedAsset(parsed.mediaAssetId);
    const ready = await readyResult(asset);
    if (ready) return ready;
    await enforceRateLimit({
      workspaceId: asset.workspaceId,
      operation: "media_thumbnail",
    });
    const run = await tasks.trigger<typeof mediaInspectionTask>(
      "media-inspection",
      {
        kind: "video_thumbnail",
        workspaceId: asset.workspaceId,
        mediaAssetId: asset.id,
      },
      {
        idempotencyKey: `video-thumbnail:v1:${asset.workspaceId}:${asset.id}:${parsed.requestId}`,
      },
    );
    const proof = sealSecret({
      key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
      plaintext: JSON.stringify({
        purpose: "video-thumbnail-v1",
        workspaceId: asset.workspaceId,
        userId: context.user.id,
        mediaAssetId: asset.id,
        runId: run.id,
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    });
    return { status: "pending", proof };
  } catch {
    return {
      status: "failed",
      error:
        "The thumbnail could not be requested. Check that this is a ready video in your workspace and try again shortly.",
    };
  }
}

/** Explicit user check only. Bind the run before retrieving any worker data. */
export async function checkVideoThumbnail(
  input: unknown,
): Promise<VideoThumbnailResult> {
  try {
    const sealed = z.string().min(1).max(4096).parse(input);
    const proof = proofSchema.parse(
      JSON.parse(
        openSecret({
          sealed,
          key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
        }),
      ) as unknown,
    );
    if (proof.expiresAt <= Date.now())
      throw new Error("THUMBNAIL_REQUEST_EXPIRED");
    const { asset, context } = await authorizedAsset(proof.mediaAssetId);
    if (
      proof.workspaceId !== asset.workspaceId ||
      proof.userId !== context.user.id
    )
      throw new Error("THUMBNAIL_REQUEST_MISMATCH");
    const ready = await readyResult(asset);
    if (ready) return ready;
    const run = await runs.retrieve(proof.runId);
    if (
      [
        "COMPLETED",
        "FAILED",
        "CANCELED",
        "CRASHED",
        "TIMED_OUT",
        "EXPIRED",
        "SYSTEM_FAILURE",
      ].includes(run.status)
    )
      return {
        status: "failed",
        error:
          "The thumbnail could not be created. You can retry; the original video is still available.",
      };
    return { status: "pending", proof: sealed };
  } catch {
    return {
      status: "failed",
      error:
        "The thumbnail status could not be checked. Refresh the library and try again.",
    };
  }
}
