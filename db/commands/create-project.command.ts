import "server-only";

import { getDatabase } from "@/db/drizzle";
import {
  projectBriefs,
  projectOutputVariants,
  projectScriptDrafts,
  projects,
  type ContentPlatform,
  type ProjectAspectRatio,
} from "@/db/schema";
import { getProjectDimensions } from "@/lib/schemas/project";
import { OUTPUT_VARIANT_DEFINITIONS } from "@/lib/output-variants/output-variant";

export async function createProject(input: {
  workspaceId: string;
  name: string;
  description: string;
  aspectRatio: ProjectAspectRatio;
  framesPerSecond: number;
  language: string;
  maximumBudgetCents: number;
  userId: string;
  /**
   * When starting a project from a saved Idea Lab idea, seeds the new
   * project's brief with the idea's fields instead of the default blank
   * brief. Omitted (or null) for every other creation path — existing
   * projects and the plain create-project flow are unaffected.
   */
  brief?: {
    topic: string;
    targetAudience: string;
    tone: string;
    targetDurationSeconds: number | null;
    primaryPlatform: ContentPlatform;
    hookAngle: string;
  } | null;
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
    getDatabase()
      .insert(projectBriefs)
      .values({
        workspaceId: input.workspaceId,
        projectId,
        updatedByUserId: input.userId,
        ...(input.brief ?? {}),
      }),
    getDatabase()
      .insert(projectOutputVariants)
      .values(
        OUTPUT_VARIANT_DEFINITIONS.map((variant) => ({
          workspaceId: input.workspaceId,
          projectId,
          name: variant.name,
          aspectRatio: variant.aspectRatio,
          width: variant.width,
          height: variant.height,
          status:
            variant.aspectRatio === input.aspectRatio
              ? ("ready" as const)
              : ("draft" as const),
          createdByUserId: input.userId,
        })),
      ),
  ]);
  const project = created[0];
  if (!project) throw new Error("Project creation returned no project.");
  return project;
}
