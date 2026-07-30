"use server";

import { revalidatePath } from "next/cache";
import {
  softDeleteMediaAsset,
  updateMediaAssetDetails,
} from "@/db/commands/media-asset-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  deleteMediaAssetSchema,
  updateMediaAssetSchema,
} from "@/lib/schemas/media-asset";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export type UpdateMediaAssetResult =
  { ok: true; asset: MediaAssetView } | { ok: false; error: string };

export type DeleteMediaAssetResult =
  { ok: true } | { ok: false; error: string };

export async function updateMediaAssetAction(
  formData: FormData,
): Promise<UpdateMediaAssetResult> {
  const parsed = updateMediaAssetSchema.safeParse({
    mediaAssetId: formData.get("mediaAssetId"),
    title: formData.get("title") ?? "",
    altText: formData.get("altText") ?? "",
    tags: formData
      .getAll("tags")
      .map((value) => String(value))
      .filter((value) => value.trim() !== ""),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Those details are not valid.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "manageMediaLibrary");

    const asset = await updateMediaAssetDetails({
      workspaceId: context.activeMembership.workspaceId,
      mediaAssetId: parsed.data.mediaAssetId,
      title: parsed.data.title,
      altText: parsed.data.altText,
      tags: parsed.data.tags,
    });
    if (!asset) return { ok: false, error: "That asset was not found." };

    revalidatePath("/app/social/library");
    const previewUrl = await createMediaAssetDownloadUrl(asset.objectKey);
    return { ok: true, asset: toMediaAssetView(asset, previewUrl) };
  } catch {
    return { ok: false, error: "Those details could not be saved." };
  }
}

/**
 * Removes an asset from the library.
 *
 * Soft delete only — the row and the stored object both survive, because a post
 * that already published must keep showing the media it sent. The asset simply
 * stops appearing in the library and can no longer be attached to anything new.
 */
export async function deleteMediaAssetAction(
  formData: FormData,
): Promise<DeleteMediaAssetResult> {
  const parsed = deleteMediaAssetSchema.safeParse({
    mediaAssetId: formData.get("mediaAssetId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That asset could not be removed." };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "manageMediaLibrary");

    const result = await softDeleteMediaAsset({
      workspaceId: context.activeMembership.workspaceId,
      mediaAssetId: parsed.data.mediaAssetId,
    });
    if (!result.deleted)
      return { ok: false, error: "That asset was not found." };

    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "media_asset_deleted",
      targetType: "media_asset",
      targetId: parsed.data.mediaAssetId,
    });
    revalidatePath("/app/social/library");
    return { ok: true };
  } catch {
    return { ok: false, error: "That asset could not be removed." };
  }
}
