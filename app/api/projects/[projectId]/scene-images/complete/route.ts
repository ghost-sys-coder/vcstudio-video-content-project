import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveUploadedSceneImage } from "@/db/commands/scene-image-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedCurrentSceneVersion } from "@/db/repositories/scene-images.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  isSceneImageUploadAspectRatioAllowed,
  sceneImageOutputFormatForUploadContentType,
} from "@/lib/domain/scene-image";
import { getSceneMediaUploadEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeSceneImageUploadSchema } from "@/lib/schemas/scene-image";
import { isSceneImageObjectKey } from "@/lib/storage/object-key";
import {
  deleteUploadedSceneImageObject,
  inspectUploadedSceneImage,
} from "@/lib/storage/scene-image-storage";

const paramsSchema = z.object({ projectId: z.uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  let uncommittedObjectKey: string | null = null;
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
      },
    );

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json(
      { error: "The project is invalid." },
      {
        status: 400,
      },
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return NextResponse.json(
        { error: "Workspace access is required." },
        {
          status: 403,
        },
      );
    const { workspaceId } = workspaceContext.activeMembership;
    requireCapability(
      workspaceContext.activeMembership.role,
      "generateSceneImages",
    );

    const project = await findProject({
      workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project || project.status === "archived")
      return NextResponse.json(
        { error: "The project is unavailable." },
        {
          status: 404,
        },
      );

    const environment = getSceneMediaUploadEnvironment();
    const parsed = completeSceneImageUploadSchema({
      allowedTypes: environment.ALLOWED_SCENE_IMAGE_UPLOAD_MIME_TYPES,
      maximumBytes: environment.MAX_SCENE_IMAGE_UPLOAD_SIZE_BYTES,
    }).safeParse(await request.json());
    const outputFormat = parsed.success
      ? sceneImageOutputFormatForUploadContentType(parsed.data.contentType)
      : null;
    if (
      !parsed.success ||
      !outputFormat ||
      !isSceneImageObjectKey({
        workspaceId,
        projectId: project.id,
        sceneId: parsed.data.sceneId,
        sceneVersionId: parsed.data.sceneVersionId,
        generationId: parsed.data.generationId,
        outputFormat,
        objectKey: parsed.data.objectKey,
      })
    )
      return NextResponse.json(
        { error: "Invalid scene image upload." },
        {
          status: 400,
        },
      );

    const currentScene = await findApprovedCurrentSceneVersion({
      workspaceId,
      projectId: project.id,
      sceneId: parsed.data.sceneId,
      sceneVersionId: parsed.data.sceneVersionId,
    });
    if (!currentScene)
      return NextResponse.json(
        { error: "The scene is unavailable." },
        {
          status: 404,
        },
      );

    uncommittedObjectKey = parsed.data.objectKey;
    const inspected = await inspectUploadedSceneImage(parsed.data.objectKey);
    if (
      inspected.sizeBytes !== parsed.data.sizeBytes ||
      inspected.contentType !== parsed.data.contentType
    )
      throw new Error("SCENE_IMAGE_UPLOAD_DECLARATION_MISMATCH");
    if (
      !isSceneImageUploadAspectRatioAllowed({
        width: inspected.width,
        height: inspected.height,
        targetSize: parsed.data.size,
      })
    )
      throw new Error("SCENE_IMAGE_UPLOAD_ASPECT_RATIO_MISMATCH");

    const created = await saveUploadedSceneImage({
      workspaceId,
      projectId: project.id,
      sceneId: parsed.data.sceneId,
      sceneVersionId: parsed.data.sceneVersionId,
      generationId: parsed.data.generationId,
      size: parsed.data.size,
      objectKey: parsed.data.objectKey,
      contentType: inspected.contentType,
      sizeBytes: inspected.sizeBytes,
      width: inspected.width,
      height: inspected.height,
      etag: inspected.etag,
      requestedByUserId: workspaceContext.user.id,
    });
    uncommittedObjectKey = null;

    revalidatePath(`/app/projects/${project.id}/storyboard`);
    return NextResponse.json({ generationId: created.id });
  } catch (error) {
    console.error(
      "Scene image upload finalization failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    if (uncommittedObjectKey)
      await deleteUploadedSceneImageObject(uncommittedObjectKey).catch(
        () => undefined,
      );
    const message =
      error instanceof Error &&
      error.message === "SCENE_IMAGE_UPLOAD_ASPECT_RATIO_MISMATCH"
        ? "This image's proportions don't match the selected size closely enough."
        : "The image could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
