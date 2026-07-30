import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { checkMediaUpload } from "@/lib/media/media-upload-limits";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { createPendingMediaAsset } from "@/db/commands/media-asset-commands";
import {
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
  requestMediaUploadSchema,
} from "@/lib/schemas/media-asset";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";
import { createMediaAssetUploadUrl } from "@/lib/storage/media-asset-storage";

/**
 * Step one of the library upload: authorize.
 *
 * Reserves the row first so the storage key is derived from a server-generated
 * UUID rather than anything the browser sent, then returns a signed PUT bound to
 * the exact content type and byte length that were approved.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  let user;
  let workspaceId: string;
  try {
    user = await requireAuthenticatedUser();
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

  const parsed = requestMediaUploadSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Unsupported file." },
      { status: 400 },
    );

  const limits = getMediaLibraryEnvironment();
  const kind = MEDIA_ASSET_KIND_BY_CONTENT_TYPE[parsed.data.contentType];
  const check = checkMediaUpload({
    kind,
    sizeBytes: parsed.data.sizeBytes,
    durationMilliseconds: parsed.data.durationMilliseconds,
    limits: {
      maxImageBytes: limits.MAX_MEDIA_IMAGE_BYTES,
      maxVideoBytes: limits.MAX_MEDIA_VIDEO_BYTES,
      maxVideoDurationSeconds: limits.MAX_MEDIA_VIDEO_DURATION_SECONDS,
    },
  });
  if (!check.allowed)
    return NextResponse.json({ error: check.reason }, { status: 400 });

  const mediaAssetId = crypto.randomUUID();
  const objectKey = createMediaLibraryObjectKey({
    workspaceId,
    mediaAssetId,
    contentType: parsed.data.contentType,
  });

  try {
    await createPendingMediaAsset({
      id: mediaAssetId,
      workspaceId,
      kind,
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      originalFileName: parsed.data.fileName,
      durationMilliseconds: parsed.data.durationMilliseconds,
      uploadedByUserId: user.id,
    });
    const uploadUrl = await createMediaAssetUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({ mediaAssetId, objectKey, uploadUrl });
  } catch {
    return NextResponse.json(
      { error: "Media upload is unavailable right now." },
      { status: 503 },
    );
  }
}
