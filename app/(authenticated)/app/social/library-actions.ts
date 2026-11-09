"use server";

import { z } from "zod";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { mediaAvailability } from "@/lib/media/media-availability";
import { mediaAssetThumbnailKey } from "@/lib/media/video-thumbnail";
import {
  loadMediaLibraryPage,
  type MediaLibraryPageView,
} from "@/lib/media/load-media-library";
import { can } from "@/lib/policies/workspace-policy";
import { decodeLibraryCursor } from "@/lib/media/library-cursor";
import { mediaPickerQuerySchema } from "@/lib/schemas/media-library";
import { reconcileMediaInspection } from "@/lib/media/reconcile-media-inspection";

export async function getMediaLibraryPageAction(
  input: unknown,
): Promise<
  { ok: true; view: MediaLibraryPageView } | { ok: false; error: string }
> {
  const parsed = mediaPickerQuerySchema.safeParse(input);
  if (
    !parsed.success ||
    (parsed.data.cursor && !decodeLibraryCursor(parsed.data.cursor))
  )
    return { ok: false, error: "The media library request is invalid." };
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "composePosts"))
    return {
      ok: false,
      error: "You do not have permission to view this library.",
    };
  try {
    return {
      ok: true,
      view: await loadMediaLibraryPage({
        workspaceId: context.activeMembership.workspaceId,
        ...parsed.data,
        visualOnly: true,
      }),
    };
  } catch {
    console.error("Media library page read failed.", {
      workspaceId: context.activeMembership.workspaceId,
    });
    return {
      ok: false,
      error: "The media library could not be loaded. Please try again.",
    };
  }
}

/** On-demand inspection status, scoped to the current authorized workspace. */
export async function getPostMediaStatusAction(
  input: unknown,
): Promise<{ ok: true; asset: MediaAssetView } | { ok: false; error: string }> {
  const parsed = z.uuid().safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "That media reference is invalid." };
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "composePosts"))
    return { ok: false, error: "You cannot check media in this workspace." };
  try {
    let asset = await findMediaAsset({
      workspaceId: context.activeMembership.workspaceId,
      mediaAssetId: parsed.data,
    });
    if (!asset || asset.deletedAt)
      return { ok: false, error: "That media is no longer available." };
    if (asset.status === "pending" && asset.inspectionTriggerRunId) {
      asset = await reconcileMediaInspection({
        workspaceId: context.activeMembership.workspaceId,
        mediaAssetId: asset.id,
      });
      if (!asset || asset.deletedAt)
        return { ok: false, error: "That media is no longer available." };
    }
    if (
      asset.status === "pending" &&
      (asset.kind !== "video" ||
        !["pending", "running", "failed"].includes(
          asset.inspectionStatus ?? "",
        ))
    )
      return {
        ok: false,
        error:
          "The upload has not started verification. Try again later or remove it from the draft.",
      };
    const previewUrl = mediaAvailability(asset).ready
      ? await createMediaAssetDownloadUrl(asset.objectKey)
      : "";
    const thumbnailKey = mediaAssetThumbnailKey(asset);
    return {
      ok: true,
      asset: toMediaAssetView(
        asset,
        previewUrl,
        thumbnailKey
          ? await createMediaAssetDownloadUrl(thumbnailKey)
          : undefined,
      ),
    };
  } catch {
    return {
      ok: false,
      error: "The media status could not be checked. Try again.",
    };
  }
}
