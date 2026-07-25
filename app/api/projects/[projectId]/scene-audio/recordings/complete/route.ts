import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveRecordedSceneAudio } from "@/db/commands/scene-audio-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedCurrentSceneVersion } from "@/db/repositories/scene-images.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { sceneAudioFormatForUploadContentType } from "@/lib/domain/scene-audio";
import { getSceneMediaUploadEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeSceneAudioRecordingUploadSchema } from "@/lib/schemas/scene-audio";
import { isSceneAudioObjectKey } from "@/lib/storage/object-key";
import {
  deleteUploadedSceneAudioObject,
  inspectUploadedSceneAudio,
} from "@/lib/storage/scene-audio-storage";

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
      "generateSceneAudio",
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
    const parsed = completeSceneAudioRecordingUploadSchema({
      allowedTypes: environment.ALLOWED_SCENE_AUDIO_UPLOAD_MIME_TYPES,
      maximumBytes: environment.MAX_SCENE_AUDIO_UPLOAD_SIZE_BYTES,
    }).safeParse(await request.json());
    if (
      !parsed.success ||
      !isSceneAudioObjectKey({
        workspaceId,
        projectId: project.id,
        sceneId: parsed.data.sceneId,
        generationId: parsed.data.generationId,
        format: sceneAudioFormatForUploadContentType(parsed.data.contentType),
        objectKey: parsed.data.objectKey,
      })
    )
      return NextResponse.json(
        { error: "Invalid scene audio recording." },
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
    const inspected = await inspectUploadedSceneAudio(parsed.data.objectKey);
    if (inspected.sizeBytes !== parsed.data.sizeBytes)
      throw new Error("SCENE_AUDIO_RECORDING_DECLARATION_MISMATCH");

    const created = await saveRecordedSceneAudio({
      workspaceId,
      projectId: project.id,
      sceneId: parsed.data.sceneId,
      sceneVersionId: parsed.data.sceneVersionId,
      generationId: parsed.data.generationId,
      objectKey: parsed.data.objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: inspected.sizeBytes,
      etag: inspected.etag,
      durationMilliseconds: parsed.data.durationMilliseconds,
      narrationText: currentScene.version.narrationText,
      requestedByUserId: workspaceContext.user.id,
    });
    uncommittedObjectKey = null;

    revalidatePath(`/app/projects/${project.id}/audio`);
    return NextResponse.json({ generationId: created.id });
  } catch (error) {
    console.error(
      "Scene audio recording finalization failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    if (uncommittedObjectKey)
      await deleteUploadedSceneAudioObject(uncommittedObjectKey).catch(
        () => undefined,
      );
    return NextResponse.json(
      { error: "The recording could not be saved." },
      {
        status: 400,
      },
    );
  }
}
