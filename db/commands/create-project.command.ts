import "server-only";

import { getDatabase } from "@/db/drizzle";
import {
  projectBriefs,
  projectOutputVariants,
  projectScriptDrafts,
  projects,
  type ContentPlatform,
  type ProjectAspectRatio,
  type ProjectVideoKind,
} from "@/db/schema";
import { getProjectDimensions } from "@/lib/schemas/project";
import { OUTPUT_VARIANT_DEFINITIONS } from "@/lib/output-variants/output-variant";

export async function createProject(input: {
  workspaceId: string;
  name: string;
  description: string;
  aspectRatio: ProjectAspectRatio;
  videoKind?: ProjectVideoKind;
  framesPerSecond: number;
  language: string;
  maximumBudgetCents: number;
  userId: string;
  /**
   * The channel this project is produced for. Null for an unassigned project,
   * which stays valid: a workspace may produce before it defines channels.
   * Validated against the workspace by the caller; the composite foreign key
   * refuses a cross-workspace pairing regardless.
   */
  channelProfileId?: string | null;
  /**
   * The exact format version this project inherits from. Stored as a snapshot
   * so a later edit to the preset cannot reach back into this project.
   */
  formatPresetVersionId?: string | null;
  /**
   * The visual style version this project's images default to. A snapshot for
   * the same reason as the format version above.
   */
  stylePresetVersionId?: string | null;
  /** The saved idea this project started from, for repeat-use history. */
  sourceContentIdeaId?: string | null;
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
    niche: string;
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
        ...(input.videoKind ? { videoKind: input.videoKind } : {}),
        width: dimensions.width,
        height: dimensions.height,
        framesPerSecond: input.framesPerSecond,
        language: input.language,
        maximumBudgetCents: input.maximumBudgetCents,
        channelProfileId: input.channelProfileId ?? null,
        formatPresetVersionId: input.formatPresetVersionId ?? null,
        stylePresetVersionId: input.stylePresetVersionId ?? null,
        sourceContentIdeaId: input.sourceContentIdeaId ?? null,
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
