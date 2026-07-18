"use server";

import { revalidatePath } from "next/cache";
import {
  approveSceneAudioGeneration,
  cancelSceneAudioGeneration,
  rejectSceneAudioGeneration,
} from "@/db/commands/scene-audio-commands";
import { createVoicePreset } from "@/db/commands/voice-preset-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  SceneAudioGenerationRequestError,
  startSceneAudioGeneration,
} from "@/lib/audio/start-scene-audio-generation";
import type { SceneAudioActionResult } from "@/lib/audio/audio-view";
import {
  sceneAudioGenerationMutationSchema,
  startBulkSceneAudioGenerationSchema,
  voicePresetInputSchema,
} from "@/lib/schemas/scene-audio";

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

export async function startSceneAudioGenerationAction(
  formData: FormData,
): Promise<SceneAudioActionResult> {
  const parsed = startBulkSceneAudioGenerationSchema.safeParse({
    projectId: formData.get("projectId"),
    voicePresetId: formData.get("voicePresetId"),
    requestNonce: formData.get("requestNonce"),
    sceneIds: formData.getAll("sceneIds"),
  });
  if (!parsed.success)
    return { success: false, error: "The audio generation request is invalid." };

  try {
    const { context, project } = await requireProjectAccess(
      parsed.data.projectId,
    );
    requireCapability(context.activeMembership.role, "generateSceneAudio");
    if (project.status === "archived")
      return { success: false, error: "This project is archived." };
    await startSceneAudioGeneration({
      workspaceId: context.activeMembership.workspaceId,
      requestedByUserId: context.user.id,
      project,
      voicePresetId: parsed.data.voicePresetId,
      sceneIds: parsed.data.sceneIds,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${project.id}/audio`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof SceneAudioGenerationRequestError
          ? error.message
          : "The audio generation could not be started.",
    };
  }
}

export async function approveSceneAudioAction(
  formData: FormData,
): Promise<SceneAudioActionResult> {
  const parsed = sceneAudioGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The narration is invalid." };
  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    requireCapability(context.activeMembership.role, "reviewSceneAudio");
    await approveSceneAudioGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/audio`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "Only a successful narration can be approved.",
    };
  }
}

export async function rejectSceneAudioAction(
  formData: FormData,
): Promise<SceneAudioActionResult> {
  const parsed = sceneAudioGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The narration is invalid." };
  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    requireCapability(context.activeMembership.role, "reviewSceneAudio");
    await rejectSceneAudioGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/audio`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "Only a successful narration can be rejected.",
    };
  }
}

export async function cancelSceneAudioAction(
  formData: FormData,
): Promise<SceneAudioActionResult> {
  const parsed = sceneAudioGenerationMutationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "The narration is invalid." };
  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    requireCapability(context.activeMembership.role, "generateSceneAudio");
    await cancelSceneAudioGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      generationId: parsed.data.generationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/audio`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The narration could not be cancelled." };
  }
}

export async function createVoicePresetAction(
  formData: FormData,
): Promise<SceneAudioActionResult> {
  const parsed = voicePresetInputSchema
    .extend({ projectId: startBulkSceneAudioGenerationSchema.shape.projectId })
    .safeParse({
      projectId: formData.get("projectId"),
      name: formData.get("name"),
      voice: formData.get("voice"),
      model: formData.get("model"),
      instructions: formData.get("instructions") ?? "",
      speedScaledPercent: formData.get("speedScaledPercent") ?? 100,
      format: formData.get("format") ?? "mp3",
      isDefault: formData.get("isDefault") === "true",
    });
  if (!parsed.success)
    return { success: false, error: "The voice preset is invalid." };

  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    requireCapability(context.activeMembership.role, "manageVoicePresets");
    await createVoicePreset({
      workspaceId: context.activeMembership.workspaceId,
      createdByUserId: context.user.id,
      name: parsed.data.name,
      voice: parsed.data.voice,
      model: parsed.data.model,
      instructions: parsed.data.instructions,
      speedScaledPercent: parsed.data.speedScaledPercent,
      format: parsed.data.format,
      isDefault: parsed.data.isDefault,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/audio`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The voice preset could not be created." };
  }
}
