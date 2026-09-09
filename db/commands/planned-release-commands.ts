import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projects } from "@/db/schema";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found in this workspace.");
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Records or clears when a creator intends to release a project.
 *
 * This is editorial intent only. It never touches `projects.status` and no
 * readiness value is derived from it, so scheduling a video can never make it
 * look further along than its actual output warrants. The workspace is part of
 * the predicate, so a project in another workspace is simply not found.
 */
export async function setProjectPlannedRelease(input: {
  workspaceId: string;
  projectId: string;
  plannedReleaseAt: Date | null;
}) {
  const [project] = await getDatabase()
    .update(projects)
    .set({ plannedReleaseAt: input.plannedReleaseAt, updatedAt: new Date() })
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.id, input.projectId),
      ),
    )
    .returning();
  if (!project) throw new ProjectNotFoundError();
  return project;
}
