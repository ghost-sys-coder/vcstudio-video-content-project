import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  type ProjectAspectRatio,
  type ProjectStatus,
} from "@/db/schema";
import { canTransitionProjectStatus } from "@/lib/domain/project-status";
import { getProjectDimensions } from "@/lib/schemas/project";

export async function updateProject(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  aspectRatio: ProjectAspectRatio;
  framesPerSecond: number;
  language: string;
  maximumBudgetCents: number;
  currentStatus: ProjectStatus;
  status: ProjectStatus;
}) {
  if (!canTransitionProjectStatus(input.currentStatus, input.status)) {
    throw new Error("Invalid project status transition.");
  }
  const dimensions = getProjectDimensions(input.aspectRatio);
  const [project] = await getDatabase()
    .update(projects)
    .set({
      name: input.name,
      description: input.description,
      aspectRatio: input.aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      framesPerSecond: input.framesPerSecond,
      language: input.language,
      maximumBudgetCents: input.maximumBudgetCents,
      status: input.status,
      archivedAt: input.status === "archived" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.id, input.projectId),
      ),
    )
    .returning();
  if (!project) throw new Error("Project update returned no project.");
  return project;
}
