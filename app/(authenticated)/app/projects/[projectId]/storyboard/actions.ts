"use server";

import { revalidatePath } from "next/cache";
import { cancelSceneImageBatch } from "@/db/commands/scene-image-batch-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { RateLimitExceededError } from "@/lib/domain/errors";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import {
  BulkSceneImageGenerationRequestError,
  startBulkSceneImageGeneration,
} from "@/lib/scenes/start-bulk-scene-image-generation";
import {
  cancelSceneImageBatchSchema,
  startBulkSceneImageGenerationSchema,
} from "@/lib/schemas/bulk-scene-image";
import type { BulkSceneImageActionResult } from "@/lib/scenes/storyboard-view";

async function requireProjectAccess(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return { context, project };
}

export async function startBulkSceneImageGenerationAction(
  formData: FormData,
): Promise<BulkSceneImageActionResult> {
  const parsed = startBulkSceneImageGenerationSchema.safeParse({
    projectId: formData.get("projectId"),
    stylePresetVersionId: formData.get("stylePresetVersionId"),
    quality: formData.get("quality"),
    requestNonce: formData.get("requestNonce"),
    sceneIds: formData.getAll("sceneIds"),
    sizes: formData.getAll("sizes"),
  });
  if (!parsed.success)
    return { success: false, error: "The bulk generation request is invalid." };

  try {
    const { context, project } = await requireProjectAccess(
      parsed.data.projectId,
    );
    requireCapability(context.activeMembership.role, "generateSceneImages");
    if (project.status === "archived")
      return {
        success: false,
        error: "This project is archived.",
      };
    await startBulkSceneImageGeneration({
      workspaceId: context.activeMembership.workspaceId,
      requestedByUserId: context.user.id,
      project,
      request: parsed.data,
    });
    revalidatePath(`/app/projects/${project.id}/storyboard`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    return {
      success: false,
      error:
        error instanceof BulkSceneImageGenerationRequestError
          ? error.message
          : "The bulk image generation could not be started.",
    };
  }
}

export async function cancelSceneImageBatchAction(
  formData: FormData,
): Promise<BulkSceneImageActionResult> {
  const parsed = cancelSceneImageBatchSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The batch is invalid." };

  try {
    const { context, project } = await requireProjectAccess(
      parsed.data.projectId,
    );
    requireCapability(context.activeMembership.role, "generateSceneImages");
    await cancelSceneImageBatch({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      batchId: parsed.data.batchId,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      projectId: parsed.data.projectId,
      action: "generation_cancelled",
      targetType: "scene_image_batch",
      targetId: parsed.data.batchId,
    });
    revalidatePath(`/app/projects/${project.id}/storyboard`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The batch could not be cancelled.",
    };
  }
}
