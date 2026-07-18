import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { createSceneAudioDownloadUrl } from "@/lib/storage/scene-audio-storage";

const paramsSchema = z.object({
  projectId: z.uuid(),
  generationId: z.uuid(),
});

type Params = { projectId: string; generationId: string };

function empty(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId) return empty(401);

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return empty(400);

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext) return empty(403);
    const workspaceId = workspaceContext.activeMembership.workspaceId;
    const project = await findProject({
      workspaceId,
      projectId: parsed.data.projectId,
    });
    if (!project) return empty(404);
    const generation = await findSceneAudioGeneration({
      workspaceId,
      projectId: project.id,
      generationId: parsed.data.generationId,
    });
    if (
      !generation ||
      generation.status !== "succeeded" ||
      !generation.assetObjectKey
    )
      return empty(404);

    const response = NextResponse.redirect(
      await createSceneAudioDownloadUrl(generation.assetObjectKey),
      307,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return empty(500);
  }
}
