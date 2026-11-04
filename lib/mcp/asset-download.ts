import "server-only";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export async function loadMcpAssetDownload(
  mediaAssetId: string,
  workspaceId: unknown,
) {
  const user = await requireAuthenticatedUser();
  const workspace = z.uuid().parse(workspaceId);
  z.uuid().parse(mediaAssetId);
  await requireWorkspaceMembership({ userId: user.id, workspaceId: workspace });
  const asset = await findMediaAsset({ workspaceId: workspace, mediaAssetId });
  if (!asset || asset.deletedAt || asset.status !== "ready") return null;
  return createMediaAssetDownloadUrl(asset.objectKey, 60);
}
