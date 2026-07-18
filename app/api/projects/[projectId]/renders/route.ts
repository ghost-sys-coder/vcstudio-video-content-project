import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadRenderWorkspace } from "@/lib/render/render-workspace-details";
import type { RenderWorkspaceResponse } from "@/lib/render/render-view";
import { renderRouteParamsSchema } from "@/lib/schemas/render";

type Params = { projectId: string };

function jsonResponse(
  body: RenderWorkspaceResponse,
  status = 200,
): NextResponse<RenderWorkspaceResponse> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return jsonResponse(
      { success: false, error: "Authentication is required." },
      401,
    );

  const parsedParams = renderRouteParamsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return jsonResponse(
      { success: false, error: "The render request is invalid." },
      400,
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return jsonResponse(
        { success: false, error: "Workspace access is required." },
        403,
      );
    const project = await findProject({
      workspaceId: workspaceContext.activeMembership.workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project)
      return jsonResponse(
        { success: false, error: "The project was not found." },
        404,
      );
    const data = await loadRenderWorkspace({
      workspaceId: workspaceContext.activeMembership.workspaceId,
      project,
    });
    return jsonResponse({ success: true, data });
  } catch {
    return jsonResponse(
      { success: false, error: "The render workspace could not be loaded." },
      500,
    );
  }
}
