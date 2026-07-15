"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject } from "@/db/commands/create-project.command";
import {
  createScriptVersion,
  deleteScriptVersion,
  restoreScriptVersion,
  saveScriptDraft,
} from "@/db/commands/script-commands";
import { updateProject } from "@/db/commands/update-project.command";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
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
    const project = await createProject({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
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
