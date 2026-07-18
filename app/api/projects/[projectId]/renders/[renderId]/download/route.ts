import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { isVideoExportObjectKey } from "@/lib/storage/object-key";
import { createVideoExportDownloadUrl } from "@/lib/storage/video-export-storage";
import { renderDownloadParamsSchema } from "@/lib/schemas/render";

type Params = { projectId: string; renderId: string };

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Authorizes a workspace member for a specific succeeded render, then redirects
 * to a freshly minted short-lived signed URL. The signed URL is never logged
 * and the export bucket stays private, so access always flows through this
 * authorization check.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return errorResponse("Authentication is required.", 401);

  const parsedParams = renderDownloadParamsSchema.safeParse(
    await context.params,
  );
  if (!parsedParams.success)
    return errorResponse("The download request is invalid.", 400);

  const workspaceContext = await getAuthenticatedWorkspaceContext();
  if (!workspaceContext)
    return errorResponse("Workspace access is required.", 403);
  const workspaceId = workspaceContext.activeMembership.workspaceId;

  const project = await findProject({
    workspaceId,
    projectId: parsedParams.data.projectId,
  });
  if (!project) return errorResponse("The project was not found.", 404);

  const render = await findVideoRender({
    workspaceId,
    projectId: parsedParams.data.projectId,
    renderId: parsedParams.data.renderId,
  });
  if (
    !render ||
    render.status !== "succeeded" ||
    !render.assetObjectKey ||
    !isVideoExportObjectKey({
      workspaceId,
      projectId: parsedParams.data.projectId,
      renderId: parsedParams.data.renderId,
      objectKey: render.assetObjectKey,
    })
  )
    return errorResponse("The export is not available.", 404);

  const signedUrl = await createVideoExportDownloadUrl(render.assetObjectKey);
  return NextResponse.redirect(signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
