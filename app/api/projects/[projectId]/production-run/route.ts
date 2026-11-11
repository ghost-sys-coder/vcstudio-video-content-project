import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  loadProductionRunPanel,
  type ProductionRunPanelView,
} from "@/lib/production-runs/production-run-view";

type Response =
  | { success: true; panel: ProductionRunPanelView }
  | { success: false; error: string };

const paramsSchema = z.object({ projectId: z.uuid() });

function json(body: Response, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** The production run panel polls this while a run is active. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return json({ success: false, error: "Authentication is required." }, 401);
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return json({ success: false, error: "That request is invalid." }, 400);
  const workspaceContext = await getAuthenticatedWorkspaceContext();
  if (!workspaceContext)
    return json(
      { success: false, error: "Workspace context is unavailable." },
      403,
    );
  const workspaceId = workspaceContext.activeMembership.workspaceId;
  const project = await findProject({
    workspaceId,
    projectId: parsed.data.projectId,
  });
  if (!project)
    return json({ success: false, error: "That project is unavailable." }, 404);
  const panel = await loadProductionRunPanel({
    workspaceId,
    projectId: project.id,
  });
  return json({ success: true, panel });
}
