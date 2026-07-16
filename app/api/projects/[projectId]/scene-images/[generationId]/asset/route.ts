import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { sceneImageAssetRouteParamsSchema } from "@/lib/schemas/scene-image-action";
import { isSceneImageObjectKey } from "@/lib/storage/object-key";
import { createSceneImageDownloadUrl } from "@/lib/storage/scene-image-storage";

type Params = { projectId: string; generationId: string };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return new NextResponse(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });

  const parsed = sceneImageAssetRouteParamsSchema.safeParse(
    await context.params,
  );
  if (!parsed.success)
    return new NextResponse(null, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return new NextResponse(null, {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      });
    const workspaceId = workspaceContext.activeMembership.workspaceId;
    const project = await findProject({
      workspaceId,
      projectId: parsed.data.projectId,
    });
    if (!project)
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const generation = await findSceneImageGeneration({
      workspaceId,
      projectId: project.id,
      generationId: parsed.data.generationId,
    });
    if (
      !generation ||
      generation.status !== "succeeded" ||
      !generation.assetObjectKey ||
      !isSceneImageObjectKey({
        workspaceId,
        projectId: project.id,
        sceneId: generation.sceneId,
        sceneVersionId: generation.sceneVersionId,
        generationId: generation.id,
        outputFormat: generation.outputFormat,
        objectKey: generation.assetObjectKey,
      })
    )
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });

    const response = NextResponse.redirect(
      await createSceneImageDownloadUrl(generation.assetObjectKey),
      307,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse(null, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
