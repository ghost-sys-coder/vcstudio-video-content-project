import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  loadReframeTargets,
  type ReframeTargetView,
} from "@/lib/reframe/reframe-job-view";

type Response =
  | { success: true; targets: ReframeTargetView[] }
  | { success: false; error: string };

const paramsSchema = z.object({ projectId: z.uuid() });

function json(body: Response, status = 200) {
  return NextResponse.json(body, {
    status,
    // Progress that a cache could serve stale would be worse than none.
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * The reframe panel polls this while a job is running.
 *
 * A dedicated endpoint rather than refreshing the route: the render page loads
 * several unrelated things, and re-running all of them every few seconds to
 * move one progress bar would put that load on the database for nothing.
 */
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
    return json({ success: false, error: "Workspace context is unavailable." }, 403);

  const project = await findProject({
    workspaceId: workspaceContext.activeMembership.workspaceId,
    projectId: parsed.data.projectId,
  });
  if (!project)
    return json({ success: false, error: "That project is unavailable." }, 404);

  const targets = await loadReframeTargets({
    workspaceId: workspaceContext.activeMembership.workspaceId,
    project,
  });
  return json({ success: true, targets });
}
