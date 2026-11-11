"use server";

import { revalidatePath } from "next/cache";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  cancelOpenProductionRun,
  ProductionRunRequestError,
  resumeHeldProductionRun,
  startProductionRun,
} from "@/lib/production-runs/start-production-run";
import {
  productionRunMutationSchema,
  startProductionRunSchema,
} from "@/lib/schemas/production-run";

export type ProductionRunActionResult = {
  success: boolean;
  error: string | null;
};

async function requireRunMutation(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  requireCapability(context.activeMembership.role, "runProduction");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return { context, project };
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ProductionRunRequestError ? error.message : fallback;
}

export async function startProductionRunAction(
  formData: FormData,
): Promise<ProductionRunActionResult> {
  const parsed = startProductionRunSchema.safeParse({
    projectId: formData.get("projectId"),
    scriptMode: formData.get("scriptMode"),
    scenesMode: formData.get("scenesMode"),
    imagesMode: formData.get("imagesMode"),
    audioMode: formData.get("audioMode"),
    renderMode: formData.get("renderMode"),
    imageQuality: formData.get("imageQuality"),
    voicePresetId: formData.get("voicePresetId") ?? "",
    maximumCostDollars: formData.get("maximumCostDollars"),
    retryFailedStages: formData.get("retryFailedStages") ?? "true",
  });
  if (!parsed.success)
    return { success: false, error: "The run settings are invalid." };
  try {
    const { context, project } = await requireRunMutation(
      parsed.data.projectId,
    );
    await startProductionRun({
      workspaceId: context.activeMembership.workspaceId,
      project,
      requestedByUserId: context.user.id,
      request: parsed.data,
    });
    revalidatePath(`/app/projects/${project.id}`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: describeError(error, "The run could not be started."),
    };
  }
}

export async function cancelProductionRunAction(
  formData: FormData,
): Promise<ProductionRunActionResult> {
  const parsed = productionRunMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { success: false, error: "Invalid run." };
  try {
    const { context } = await requireRunMutation(parsed.data.projectId);
    await cancelOpenProductionRun({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      runId: parsed.data.runId,
      actorUserId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: describeError(error, "The run could not be cancelled."),
    };
  }
}

export async function resumeProductionRunAction(
  formData: FormData,
): Promise<ProductionRunActionResult> {
  const parsed = productionRunMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { success: false, error: "Invalid run." };
  try {
    const { context } = await requireRunMutation(parsed.data.projectId);
    await resumeHeldProductionRun({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      runId: parsed.data.runId,
      actorUserId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: describeError(error, "The run could not be resumed."),
    };
  }
}
