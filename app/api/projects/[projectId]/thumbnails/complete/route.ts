import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveUploadedThumbnail } from "@/db/commands/thumbnail-generation-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  isSceneImageUploadAspectRatioAllowed,
  sceneImageOutputFormatForUploadContentType,
} from "@/lib/domain/scene-image";
import { getSceneMediaUploadEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  completeThumbnailUploadSchema,
  getThumbnailSizeForPlatform,
} from "@/lib/schemas/thumbnail";
import { isThumbnailObjectKey } from "@/lib/storage/object-key";
import {
  deleteUploadedThumbnailObject,
  inspectUploadedThumbnail,
} from "@/lib/storage/thumbnail-storage";

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * Records an uploaded thumbnail after checking what actually landed in storage.
 *
 * Three things are verified rather than trusted: the object key must be exactly
 * the one this workspace and project were authorized for, the stored bytes must
 * match the declared type and length, and the image's proportions must match
 * the platform's own thumbnail shape closely enough not to be stretched or
 * cropped downstream. A failure removes the orphaned object so a rejected
 * upload never lingers in the bucket.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  let uncommittedObjectKey: string | null = null;
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json(
      { error: "The project is invalid." },
      { status: 400 },
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return NextResponse.json(
        { error: "Workspace access is required." },
        { status: 403 },
      );
    const { workspaceId } = workspaceContext.activeMembership;
    requireCapability(
      workspaceContext.activeMembership.role,
      "mutateWorkspaceData",
    );

    const project = await findProject({
      workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project || project.status === "archived")
      return NextResponse.json(
        { error: "The project is unavailable." },
        { status: 404 },
      );

    const environment = getSceneMediaUploadEnvironment();
    const parsed = completeThumbnailUploadSchema({
      allowedTypes: environment.ALLOWED_SCENE_IMAGE_UPLOAD_MIME_TYPES,
      maximumBytes: environment.MAX_SCENE_IMAGE_UPLOAD_SIZE_BYTES,
    }).safeParse(await request.json());
    const outputFormat = parsed.success
      ? sceneImageOutputFormatForUploadContentType(parsed.data.contentType)
      : null;
    if (
      !parsed.success ||
      !outputFormat ||
      !isThumbnailObjectKey({
        workspaceId,
        projectId: project.id,
        platform: parsed.data.platform,
        thumbnailGenerationId: parsed.data.thumbnailGenerationId,
        outputFormat,
        objectKey: parsed.data.objectKey,
      })
    )
      return NextResponse.json(
        { error: "Invalid thumbnail upload." },
        { status: 400 },
      );

    const size = getThumbnailSizeForPlatform(parsed.data.platform);
    uncommittedObjectKey = parsed.data.objectKey;
    const inspected = await inspectUploadedThumbnail(parsed.data.objectKey);
    if (
      inspected.sizeBytes !== parsed.data.sizeBytes ||
      inspected.contentType !== parsed.data.contentType
    )
      throw new Error("THUMBNAIL_UPLOAD_DECLARATION_MISMATCH");
    if (
      !isSceneImageUploadAspectRatioAllowed({
        width: inspected.width,
        height: inspected.height,
        targetSize: size,
      })
    )
      throw new Error("THUMBNAIL_UPLOAD_ASPECT_RATIO_MISMATCH");

    const created = await saveUploadedThumbnail({
      workspaceId,
      projectId: project.id,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
      platform: parsed.data.platform,
      size,
      outputFormat,
      objectKey: parsed.data.objectKey,
      contentType: inspected.contentType,
      sizeBytes: inspected.sizeBytes,
      width: inspected.width,
      height: inspected.height,
      etag: inspected.etag,
      requestedByUserId: workspaceContext.user.id,
    });
    uncommittedObjectKey = null;

    revalidatePath(`/app/projects/${project.id}/publish`);
    return NextResponse.json({ thumbnailGenerationId: created.id });
  } catch (error) {
    console.error(
      "Thumbnail upload finalization failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    if (uncommittedObjectKey)
      await deleteUploadedThumbnailObject(uncommittedObjectKey).catch(
        () => undefined,
      );
    const message =
      error instanceof Error &&
      error.message === "THUMBNAIL_UPLOAD_ASPECT_RATIO_MISMATCH"
        ? "This image's proportions don't match the platform's thumbnail shape closely enough."
        : "The thumbnail could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
