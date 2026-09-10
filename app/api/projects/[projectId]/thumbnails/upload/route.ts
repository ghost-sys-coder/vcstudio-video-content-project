import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { sceneImageOutputFormatForUploadContentType } from "@/lib/domain/scene-image";
import { getSceneMediaUploadEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  createThumbnailUploadSchema,
  getThumbnailSizeForPlatform,
} from "@/lib/schemas/thumbnail";
import { createThumbnailObjectKey } from "@/lib/storage/object-key";
import { createThumbnailUploadUrl } from "@/lib/storage/thumbnail-storage";

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * Authorizes a signed PUT for a thumbnail the creator already has.
 *
 * The upload is bound to the exact content type and byte length declared here,
 * and the file that actually lands is re-inspected by the completion route, so
 * nothing the browser claims is taken as final.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
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
    const parsed = createThumbnailUploadSchema({
      allowedTypes: environment.ALLOWED_SCENE_IMAGE_UPLOAD_MIME_TYPES,
      maximumBytes: environment.MAX_SCENE_IMAGE_UPLOAD_SIZE_BYTES,
    }).safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid image." },
        { status: 400 },
      );

    const thumbnailGenerationId = crypto.randomUUID();
    const objectKey = createThumbnailObjectKey({
      workspaceId,
      projectId: project.id,
      platform: parsed.data.platform,
      thumbnailGenerationId,
      outputFormat: sceneImageOutputFormatForUploadContentType(
        parsed.data.contentType,
      ),
    });
    const uploadUrl = await createThumbnailUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({
      objectKey,
      uploadUrl,
      thumbnailGenerationId,
      size: getThumbnailSizeForPlatform(parsed.data.platform),
    });
  } catch (error) {
    console.error(
      "Thumbnail upload authorization failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    return NextResponse.json(
      { error: "Thumbnail upload is unavailable." },
      { status: 403 },
    );
  }
}
