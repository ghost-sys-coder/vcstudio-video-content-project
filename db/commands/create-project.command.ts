import "server-only";

import { getDatabase } from "@/db/drizzle";
import {
  projectScriptDrafts,
  projects,
  type ProjectAspectRatio,
} from "@/db/schema";
import { getProjectDimensions } from "@/lib/schemas/project";

export async function createProject(input: {
  workspaceId: string;
  name: string;
  description: string;
  aspectRatio: ProjectAspectRatio;
  framesPerSecond: number;
  language: string;
  maximumBudgetCents: number;
  userId: string;
}) {
  const projectId = crypto.randomUUID();
  const dimensions = getProjectDimensions(input.aspectRatio);
  const [created] = await getDatabase().batch([
    getDatabase()
      .insert(projects)
      .values({
        id: projectId,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        aspectRatio: input.aspectRatio,
        width: dimensions.width,
        height: dimensions.height,
        framesPerSecond: input.framesPerSecond,
        language: input.language,
        maximumBudgetCents: input.maximumBudgetCents,
        createdByUserId: input.userId,
      })
      .returning(),
    getDatabase().insert(projectScriptDrafts).values({
      workspaceId: input.workspaceId,
      projectId,
      updatedByUserId: input.userId,
    }),
  ]);
  const project = created[0];
  if (!project) throw new Error("Project creation returned no project.");
  return project;
}
