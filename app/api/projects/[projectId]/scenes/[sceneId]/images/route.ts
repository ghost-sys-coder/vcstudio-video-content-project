import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadSceneImageDetails } from "@/lib/scenes/scene-image-details";
import type { SceneImageDetailsResponse } from "@/lib/scenes/scene-image-view";
import {
  sceneImageDetailsQuerySchema,
  sceneImageDetailsRouteParamsSchema,
} from "@/lib/schemas/scene-image-action";

type Params = { projectId: string; sceneId: string };

function jsonResponse(
  body: SceneImageDetailsResponse,
  status = 200,
): NextResponse<SceneImageDetailsResponse> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return jsonResponse(
      { success: false, error: "Authentication is required." },
      401,
    );

  const parsedParams = sceneImageDetailsRouteParamsSchema.safeParse(
    await context.params,
  );
  const parsedQuery = sceneImageDetailsQuerySchema.safeParse({
    sceneVersionId: new URL(request.url).searchParams.get("sceneVersionId"),
  });
  if (!parsedParams.success || !parsedQuery.success)
    return jsonResponse(
      { success: false, error: "The scene image request is invalid." },
      400,
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return jsonResponse(
        { success: false, error: "Workspace access is required." },
        403,
      );
    const workspaceId = workspaceContext.activeMembership.workspaceId;
    const project = await findProject({
      workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project)
      return jsonResponse(
        { success: false, error: "The project was not found." },
        404,
      );
    const details = await loadSceneImageDetails({
      workspaceId,
      project,
      sceneId: parsedParams.data.sceneId,
      sceneVersionId: parsedQuery.data.sceneVersionId,
    });
    if (!details)
      return jsonResponse(
        {
          success: false,
          error: "The current scene version was not found.",
        },
        404,
      );
    return jsonResponse({ success: true, data: details });
  } catch {
    return jsonResponse(
      { success: false, error: "Scene image details could not be loaded." },
      500,
    );
  }
}
