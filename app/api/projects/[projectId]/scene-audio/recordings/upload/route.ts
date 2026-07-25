import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedCurrentSceneVersion } from "@/db/repositories/scene-images.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { sceneAudioFormatForUploadContentType } from "@/lib/domain/scene-audio";
import { getSceneMediaUploadEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { createSceneAudioRecordingUploadSchema } from "@/lib/schemas/scene-audio";
import { createSceneAudioObjectKey } from "@/lib/storage/object-key";
import { createSceneAudioUploadUrl } from "@/lib/storage/scene-audio-storage";

const paramsSchema = z.object({ projectId: z.uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
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
    const parsed = createSceneAudioRecordingUploadSchema({
      allowedTypes: environment.ALLOWED_SCENE_AUDIO_UPLOAD_MIME_TYPES,
      maximumBytes: environment.MAX_SCENE_AUDIO_UPLOAD_SIZE_BYTES,
    }).safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid recording." },
        { status: 400 },
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

    const generationId = crypto.randomUUID();
    const objectKey = createSceneAudioObjectKey({
      workspaceId,
      projectId: project.id,
      sceneId: parsed.data.sceneId,
      generationId,
      format: sceneAudioFormatForUploadContentType(parsed.data.contentType),
    });
    const uploadUrl = await createSceneAudioUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({ objectKey, uploadUrl, generationId });
  } catch (error) {
    console.error(
      "Scene audio recording upload authorization failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    return NextResponse.json(
      { error: "Recording upload is unavailable." },
      {
        status: 403,
      },
    );
  }
}
