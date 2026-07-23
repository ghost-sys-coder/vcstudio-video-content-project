"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createProject } from "@/db/commands/create-project.command";
import { findContentIdea } from "@/db/repositories/content-ideas.repository";
import {
  createScriptVersion,
  deleteScriptVersion,
  restoreScriptVersion,
  saveScriptDraft,
} from "@/db/commands/script-commands";
import { cancelScriptGeneration } from "@/db/commands/script-generation-commands";
import { saveProjectBrief } from "@/db/commands/project-brief.command";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { updateProject } from "@/db/commands/update-project.command";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import {
  applyIdeaToBrief,
  ApplyIdeaError,
} from "@/lib/ideas/apply-idea-to-brief";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  startScriptGeneration,
  ScriptGenerationRequestError,
} from "@/lib/scripts/start-script-generation";
import {
  loadScriptGenerationView,
  type ScriptGenerationView,
} from "@/lib/scripts/script-generation-view";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { applyIdeaToBriefSchema } from "@/lib/schemas/idea-generation";
import {
  briefSchema,
  createProjectSchema,
  createScriptContentSchema,
  createScriptVersionSchema,
  deleteScriptVersionSchema,
  restoreScriptVersionSchema,
  scriptMutationSchema,
  updateProjectSchema,
} from "@/lib/schemas/project";

export type ProjectActionState = {
  error: string | null;
  success: boolean;
  revision?: number;
};

async function requireProjectMutation(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("Workspace context missing.");
  requireCapability(context.activeMembership.role, "mutateWorkspaceData");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("Project not found.");
  return { context, project };
}

export async function createProjectAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const values = Object.fromEntries(formData);
  values.maximumBudgetCents = String(
    Math.round(Number(formData.get("budgetDollars")) * 100),
  );
  const parsed = createProjectSchema.safeParse(values);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project.",
      success: false,
    };
  let projectId: string;
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { error: "Workspace context is unavailable.", success: false };
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");

    // Optional: starting the project from a saved Idea Lab idea. A missing,
    // foreign, or malformed id just falls back to a blank brief rather than
    // failing project creation — this only affects the pre-fill.
    const rawIdeaId = formData.get("ideaId");
    const ideaIdCheck =
      typeof rawIdeaId === "string" ? z.uuid().safeParse(rawIdeaId) : null;
    const idea = ideaIdCheck?.success
      ? await findContentIdea({
          workspaceId: context.activeMembership.workspaceId,
          ideaId: ideaIdCheck.data,
        })
      : null;

    const project = await createProject({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      brief: idea
        ? {
            topic: idea.topic,
            targetAudience: idea.targetAudience,
            tone: idea.tone,
            targetDurationSeconds: idea.targetDurationSeconds,
            primaryPlatform: idea.primaryPlatform,
            hookAngle: idea.hookAngle,
            niche: idea.niche,
          }
        : null,
    });
    projectId = project.id;
  } catch {
    return { error: "The project could not be created.", success: false };
  }
  revalidatePath("/app/projects");
  redirect(`/app/projects/${projectId}/script`);
}

export async function updateProjectAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const values = Object.fromEntries(formData);
  values.maximumBudgetCents = String(
    Math.round(Number(formData.get("budgetDollars")) * 100),
  );
  const parsed = updateProjectSchema.safeParse(values);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project settings.",
      success: false,
    };
  try {
    const { context, project } = await requireProjectMutation(
      parsed.data.projectId,
    );
    await updateProject({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      currentStatus: project.status,
    });
    revalidatePath(`/app/projects/${project.id}`, "layout");
    revalidatePath("/app/projects");
    return { error: null, success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.includes("transition")
          ? error.message
          : "Project settings could not be updated.",
      success: false,
    };
  }
}

export async function saveProjectBriefAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const rawDuration = String(
    formData.get("targetDurationSeconds") ?? "",
  ).trim();
  const parsed = briefSchema.safeParse({
    projectId: formData.get("projectId"),
    topic: formData.get("topic") ?? "",
    targetAudience: formData.get("targetAudience") ?? "",
    tone: formData.get("tone") ?? "",
    targetDurationSeconds: rawDuration === "" ? undefined : rawDuration,
    primaryPlatform: formData.get("primaryPlatform"),
    hookAngle: formData.get("hookAngle") ?? "",
    niche: formData.get("niche") ?? "",
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid brief.",
      success: false,
    };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    await saveProjectBrief({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      topic: parsed.data.topic,
      targetAudience: parsed.data.targetAudience,
      tone: parsed.data.tone,
      targetDurationSeconds: parsed.data.targetDurationSeconds ?? null,
      primaryPlatform: parsed.data.primaryPlatform,
      hookAngle: parsed.data.hookAngle,
      niche: parsed.data.niche,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { error: null, success: true };
  } catch {
    return { error: "The brief could not be saved.", success: false };
  }
}

export async function applyIdeaToBriefAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = applyIdeaToBriefSchema.safeParse({
    projectId: formData.get("projectId"),
    ideaId: formData.get("ideaId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That idea could not be applied." };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    await applyIdeaToBrief({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      projectId: parsed.data.projectId,
      ideaId: parsed.data.ideaId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApplyIdeaError)
      return { ok: false, error: error.message };
    return { ok: false, error: "That idea could not be applied." };
  }
}

export async function generateScriptAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const requestNonce = String(formData.get("requestNonce") ?? "");
  if (!projectId || !requestNonce)
    return { error: "Invalid script generation request.", success: false };
  try {
    const { context, project } = await requireProjectMutation(projectId);
    const brief = await findProjectBrief({
      workspaceId: context.activeMembership.workspaceId,
      projectId,
    });
    await startScriptGeneration({
      workspaceId: context.activeMembership.workspaceId,
      project,
      brief,
      requestedByUserId: context.user.id,
      requestNonce,
    });
    revalidatePath(`/app/projects/${projectId}/script`);
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof ScriptGenerationRequestError)
      return { error: error.message, success: false };
    if (error instanceof RateLimitExceededError)
      return { error: error.message, success: false };
    if (error instanceof BudgetExceededError)
      return {
        error:
          error.scope === "project"
            ? "This script would exceed the project budget."
            : error.scope === "workspace_daily"
              ? "This script would exceed the workspace daily budget."
              : "This script would exceed the workspace monthly budget.",
        success: false,
      };
    return { error: "The script could not be generated.", success: false };
  }
}

export async function cancelScriptGenerationAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const scriptGenerationRunId = String(
    formData.get("scriptGenerationRunId") ?? "",
  );
  if (!projectId || !scriptGenerationRunId)
    return { error: "Invalid cancel request.", success: false };
  try {
    const { context } = await requireProjectMutation(projectId);
    const result = await cancelScriptGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId,
      scriptGenerationRunId,
    });
    if (result.cancelled)
      await recordAuditEvent({
        workspaceId: context.activeMembership.workspaceId,
        actorUserId: context.user.id,
        projectId,
        action: "generation_cancelled",
        targetType: "script_generation",
        targetId: scriptGenerationRunId,
      });
    revalidatePath(`/app/projects/${projectId}/script`);
    return { error: null, success: true };
  } catch {
    return { error: "The generation could not be cancelled.", success: false };
  }
}

export async function loadScriptGenerationViewAction(
  projectId: string,
): Promise<ScriptGenerationView | null> {
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
  return loadScriptGenerationView({
    workspaceId: context.activeMembership.workspaceId,
    project,
    brief,
  });
}

export async function saveScriptDraftAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = scriptMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: "Invalid script draft.", success: false };
  if (
    !createScriptContentSchema(
      getProjectEnvironment().MAX_SCRIPT_CHARACTERS,
    ).safeParse(parsed.data.content).success
  )
    return {
      error: "The script exceeds the configured character limit.",
      success: false,
    };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    const draft = await saveScriptDraft({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { error: null, success: true, revision: draft.revision };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message === "SCRIPT_REVISION_CONFLICT"
          ? "This draft changed in another session. Refresh before saving again."
          : "The script draft could not be saved.",
      success: false,
    };
  }
}

export async function createScriptVersionAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = createScriptVersionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { error: "Invalid version request.", success: false };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    await createScriptVersion({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { error: null, success: true, revision: parsed.data.revision };
  } catch {
    return {
      error: "Save the latest draft before creating a version.",
      success: false,
    };
  }
}

export async function restoreScriptVersionAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = restoreScriptVersionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { error: "Invalid restore request.", success: false };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    const restored = await restoreScriptVersion({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { error: null, success: true, revision: restored.revision };
  } catch {
    return {
      error: "The script version could not be restored. Refresh and try again.",
      success: false,
    };
  }
}

export async function deleteScriptVersionAction(
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = deleteScriptVersionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { error: "Invalid version request.", success: false };
  try {
    const { context } = await requireProjectMutation(parsed.data.projectId);
    requireCapability(context.activeMembership.role, "deleteScriptVersions");
    await deleteScriptVersion({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/script`);
    return { error: null, success: true };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SCRIPT_VERSION_APPROVED")
      return {
        error:
          "Approved versions cannot be deleted. Approve another version first.",
        success: false,
      };
    if (code === "SCRIPT_VERSION_REFERENCED")
      return {
        error: "This version is used by a scene analysis and must be retained.",
        success: false,
      };
    return {
      error: "The script version could not be deleted.",
      success: false,
    };
  }
}
