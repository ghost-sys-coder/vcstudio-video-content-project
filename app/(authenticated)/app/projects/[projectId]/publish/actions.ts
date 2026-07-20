"use server";

import { revalidatePath } from "next/cache";
import {
  cancelTitleGeneration,
  setTitleSuggestionFavorite,
} from "@/db/commands/title-generation-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  startTitleGeneration,
  TitleGenerationRequestError,
} from "@/lib/titles/start-title-generation";
import {
  loadTitlesView,
  type TitleActionResult,
  type TitlesView,
} from "@/lib/titles/title-view";
import {
  cancelTitleGenerationSchema,
  generateTitlesSchema,
  toggleTitleFavoriteSchema,
} from "@/lib/schemas/title-generation";

async function requirePublishMutation(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  requireCapability(context.activeMembership.role, "mutateWorkspaceData");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.status === "archived") throw new Error("PROJECT_ARCHIVED");
  return { context, project };
}

export async function generateTitlesAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = generateTitlesSchema.safeParse({
    projectId: formData.get("projectId"),
    platform: formData.get("platform"),
    requestNonce: formData.get("requestNonce"),
    optionCount: formData.get("optionCount") ?? undefined,
  });
  if (!parsed.success)
    return { success: false, error: "The title request is invalid." };
  try {
    const { context, project } = await requirePublishMutation(
      parsed.data.projectId,
    );
    const brief = await findProjectBrief({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
    });
    await startTitleGeneration({
      workspaceId: context.activeMembership.workspaceId,
      project,
      brief,
      platform: parsed.data.platform,
      optionCount: parsed.data.optionCount,
      requestedByUserId: context.user.id,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof TitleGenerationRequestError)
      return { success: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error:
          error.scope === "project"
            ? "This would exceed the project budget."
            : error.scope === "workspace_daily"
              ? "This would exceed the workspace daily budget."
              : "This would exceed the workspace monthly budget.",
      };
    return { success: false, error: "The titles could not be generated." };
  }
}

export async function cancelTitleGenerationAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = cancelTitleGenerationSchema.safeParse({
    projectId: formData.get("projectId"),
    titleGenerationRunId: formData.get("titleGenerationRunId"),
  });
  if (!parsed.success)
    return { success: false, error: "The cancel request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    const result = await cancelTitleGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      titleGenerationRunId: parsed.data.titleGenerationRunId,
    });
    if (result.cancelled)
      await recordAuditEvent({
        workspaceId: context.activeMembership.workspaceId,
        actorUserId: context.user.id,
        projectId: parsed.data.projectId,
        action: "generation_cancelled",
        targetType: "title_generation",
        targetId: parsed.data.titleGenerationRunId,
      });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The generation could not be cancelled." };
  }
}

export async function toggleTitleFavoriteAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = toggleTitleFavoriteSchema.safeParse({
    projectId: formData.get("projectId"),
    suggestionId: formData.get("suggestionId"),
    isFavorite: formData.get("isFavorite"),
  });
  if (!parsed.success)
    return { success: false, error: "The request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    await setTitleSuggestionFavorite({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      suggestionId: parsed.data.suggestionId,
      isFavorite: parsed.data.isFavorite === "true",
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The favorite could not be updated." };
  }
}

export async function loadTitlesViewAction(
  projectId: string,
): Promise<TitlesView | null> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) return null;
  const brief = await findProjectBrief({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  return loadTitlesView({
    workspaceId: context.activeMembership.workspaceId,
    project,
    brief,
  });
}
