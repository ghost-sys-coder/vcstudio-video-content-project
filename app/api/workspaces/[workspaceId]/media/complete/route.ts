import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { checkMediaUpload } from "@/lib/media/media-upload-limits";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  markMediaAssetFailed,
  markMediaAssetReady,
} from "@/db/commands/media-asset-commands";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import {
  completeMediaUploadSchema,
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
} from "@/lib/schemas/media-asset";
import { isMediaLibraryObjectKey } from "@/lib/storage/object-key";
import {
  createMediaAssetDownloadUrl,
  inspectMediaAsset,
} from "@/lib/storage/media-asset-storage";
import { toMediaAssetView } from "@/lib/media/media-asset-view";

/**
 * Step two of the library upload: confirm.
 *
 * Everything the browser reported at authorize time is re-derived from storage
 * here — the real byte length, and for images the real decoded dimensions —
 * because a signed PUT proves an object was written, not that it was the object
 * that was promised. A confirmation that fails inspection leaves the row
 * `failed` rather than deleting it, so the upload is visibly broken instead of
 * silently absent.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  let workspaceId: string;
  try {
    const user = await requireAuthenticatedUser();
    ({ workspaceId } = await context.params);
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageMediaLibrary");
  } catch {
    return NextResponse.json(
      { error: "You cannot upload media to this workspace." },
      { status: 403 },
    );
  }

  const parsed = completeMediaUploadSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid upload." },
      { status: 400 },
    );

  const asset = await findMediaAsset({
    workspaceId,
    mediaAssetId: parsed.data.mediaAssetId,
  });
  if (!asset || asset.status !== "pending")
    return NextResponse.json(
      { error: "That upload is no longer pending." },
      { status: 409 },
    );

  // The key must be exactly the one this asset id and content type produce —
  // a client cannot point a completion at somebody else's object.
  if (
    !isMediaLibraryObjectKey({
      workspaceId,
      mediaAssetId: asset.id,
      contentType: parsed.data.contentType,
      objectKey: parsed.data.objectKey,
    }) ||
    parsed.data.objectKey !== asset.objectKey
  )
    return NextResponse.json(
      { error: "That upload does not belong to this asset." },
      { status: 400 },
    );

  const kind = MEDIA_ASSET_KIND_BY_CONTENT_TYPE[parsed.data.contentType];
  try {
    const inspected = await inspectMediaAsset({
      objectKey: asset.objectKey,
      kind,
    });

    const limits = getMediaLibraryEnvironment();
    const check = checkMediaUpload({
      kind,
      sizeBytes: inspected.sizeBytes,
      durationMilliseconds: parsed.data.durationMilliseconds,
      limits: {
        maxImageBytes: limits.MAX_MEDIA_IMAGE_BYTES,
        maxVideoBytes: limits.MAX_MEDIA_VIDEO_BYTES,
        maxVideoDurationSeconds: limits.MAX_MEDIA_VIDEO_DURATION_SECONDS,
      },
    });
    if (!check.allowed) {
      await markMediaAssetFailed({ workspaceId, mediaAssetId: asset.id });
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    const ready = await markMediaAssetReady({
      workspaceId,
      mediaAssetId: asset.id,
      sizeBytes: inspected.sizeBytes,
      width: inspected.width,
      height: inspected.height,
      durationMilliseconds: parsed.data.durationMilliseconds,
    });
    if (!ready)
      return NextResponse.json(
        { error: "That upload is no longer pending." },
        { status: 409 },
      );

    const previewUrl = await createMediaAssetDownloadUrl(ready.objectKey);
    return NextResponse.json({ asset: toMediaAssetView(ready, previewUrl) });
  } catch {
    await markMediaAssetFailed({ workspaceId, mediaAssetId: asset.id });
    return NextResponse.json(
      { error: "That file could not be read after uploading." },
      { status: 400 },
    );
  }
}
