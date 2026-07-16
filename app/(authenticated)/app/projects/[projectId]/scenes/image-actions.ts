"use server";

import { revalidatePath } from "next/cache";
import {
  approveSceneImageGeneration,
  rejectSceneImageGeneration,
} from "@/db/commands/scene-image-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  SceneImageGenerationRequestError,
  startSceneImageGeneration,
} from "@/lib/scenes/start-scene-image-generation";
import type { SceneImageActionResult } from "@/lib/scenes/scene-image-view";
import { sceneImageGenerationMutationSchema } from "@/lib/schemas/scene-image-action";
import { startSceneImageGenerationSchema } from "@/lib/schemas/scene-image";
import { reconcileSceneImageGeneration } from "@/lib/trigger/reconcile-scene-image";

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

async function requireProjectMutation(
  projectId: string,
  capability: "generateSceneImages" | "reviewSceneImages",
) {
  const result = await requireProjectAccess(projectId);
  requireCapability(result.context.activeMembership.role, capability);
  if (result.project.status === "archived") throw new Error("PROJECT_ARCHIVED");
  return result;
}

export async function startSceneImageGenerationAction(
  formData: FormData,
): Promise<SceneImageActionResult> {
  const parsed = startSceneImageGenerationSchema.safeParse({
    ...Object.fromEntries(formData),
    referenceAssetIds: formData.getAll("referenceAssetIds"),
  });
  if (!parsed.success)
    return {
      success: false,
      error: "The image generation request is invalid.",
    };

  try {
    const { context, project } = await requireProjectMutation(
      parsed.data.projectId,
      "generateSceneImages",
    );
    await startSceneImageGeneration({
      workspaceId: context.activeMembership.workspaceId,
      requestedByUserId: context.user.id,
      project,
      request: parsed.data,
    });
    revalidatePath(`/app/projects/${project.id}/scenes`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof SceneImageGenerationRequestError
          ? error.message
          : "The scene image generation could not be started.",
    };
  }
}

export async function reconcileSceneImageGenerationAction(
  formData: FormData,
): Promise<SceneImageActionResult> {
  const parsed = sceneImageGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The image generation is invalid." };

  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    await reconcileSceneImageGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The image generation status could not be refreshed.",
    };
  }
}

export async function approveGeneratedImageAction(
  formData: FormData,
): Promise<SceneImageActionResult> {
  const parsed = sceneImageGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The generated image is invalid." };

  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "reviewSceneImages",
    );
    await approveSceneImageGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error:
        "Only a successful image for the current approved scene version can be approved.",
    };
  }
}

export async function rejectGeneratedImageAction(
  formData: FormData,
): Promise<SceneImageActionResult> {
  const parsed = sceneImageGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The generated image is invalid." };

  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "reviewSceneImages",
    );
    await rejectSceneImageGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "Only a successful image can be rejected.",
    };
  }
}
