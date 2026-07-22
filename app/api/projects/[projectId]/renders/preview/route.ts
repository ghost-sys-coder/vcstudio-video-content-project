import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadRenderPreview } from "@/lib/render/render-preview";
import {
  renderOutputQuerySchema,
  renderRouteParamsSchema,
} from "@/lib/schemas/render";

type Params = { projectId: string };

function jsonResponse(body: unknown, status = 200) {
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

  const parsedParams = renderRouteParamsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return jsonResponse(
      { success: false, error: "The preview request is invalid." },
      400,
    );
  const parsedQuery = renderOutputQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsedQuery.success)
    return jsonResponse(
      { success: false, error: "The output format is invalid." },
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

    const preview = await loadRenderPreview({
      workspaceId: workspaceContext.activeMembership.workspaceId,
      project,
      outputVariantId: parsedQuery.data.outputVariantId,
      shortCompositionId: parsedQuery.data.shortCompositionId,
    });
    return jsonResponse({ success: true, data: preview });
  } catch {
    return jsonResponse(
      { success: false, error: "The preview could not be built." },
      500,
    );
  }
}
