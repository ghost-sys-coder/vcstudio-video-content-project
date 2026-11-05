"use server";
import { z } from "zod";
import {
  authorizeVideoWorkspace,
  quoteVideoGeneration,
  startVideoGeneration,
  resumeVideoGeneration,
  cancelQueuedVideoGeneration,
  sceneStarterVideoReference,
} from "@/lib/video-generation/video-generation-service";
export async function sceneStarterImageAction(
  workspaceId: unknown,
  value: unknown,
) {
  return videoActionResult(() =>
    sceneStarterVideoReference(workspaceId, value),
  );
}
import { videoActionResult } from "@/lib/video-generation/video-action-result";
import {
  videoGenerationSummary,
  videoHistoryView,
  videoOutputUrl,
} from "@/lib/video-generation/video-generation-view";
import { findVideoGeneration } from "@/db/repositories/video-generations.repository";
import {
  loadSceneVideoView,
  saveSceneVideoSelection,
  reviewSceneVideoSelection,
  sceneVideoPreviewUrl,
} from "@/lib/video-generation/scene-video-service";
import { updateProjectVisualDefault } from "@/db/commands/project-visual-default-command";
export async function sceneVideoViewAction(
  workspaceId: unknown,
  input: unknown,
) {
  return videoActionResult(() => loadSceneVideoView(workspaceId, input));
}
export async function saveSceneVideoAction(
  workspaceId: unknown,
  input: unknown,
) {
  return videoActionResult(() => saveSceneVideoSelection(workspaceId, input));
}
export async function reviewSceneVideoAction(
  workspaceId: unknown,
  input: unknown,
) {
  return videoActionResult(() => reviewSceneVideoSelection(workspaceId, input));
}
export async function previewSceneVideoAction(
  workspaceId: unknown,
  input: unknown,
) {
  return videoActionResult(() => sceneVideoPreviewUrl(workspaceId, input));
}
export async function projectVisualDefaultAction(
  workspaceId: unknown,
  value: unknown,
) {
  return videoActionResult(async () => {
    const context = await authorizeVideoWorkspace(workspaceId, true);
    const input = z
      .object({
        projectId: z.uuid(),
        expectedUpdatedAt: z.iso.datetime(),
        kind: z.enum(["image", "video"]),
      })
      .strict()
      .parse(value);
    const result = await updateProjectVisualDefault({
      ...context,
      ...input,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
    });
    if (!result) throw new Error("Project changed.");
    return { updatedAt: result.updatedAt.toISOString() };
  });
}
export async function quoteVideoAction(workspaceId: unknown, input: unknown) {
  return videoActionResult(() => quoteVideoGeneration(workspaceId, input));
}
export async function startVideoAction(workspaceId: unknown, input: unknown) {
  return videoActionResult(() => startVideoGeneration(workspaceId, input));
}
export async function resumeVideoAction(workspaceId: unknown, id: unknown) {
  return videoActionResult(() => resumeVideoGeneration(workspaceId, id));
}
export async function cancelVideoAction(workspaceId: unknown, id: unknown) {
  return videoActionResult(() => cancelQueuedVideoGeneration(workspaceId, id));
}
export async function videoHistoryAction(
  workspaceId: unknown,
  cursor?: string,
) {
  return videoActionResult(async () => {
    const context = await authorizeVideoWorkspace(workspaceId);
    return videoHistoryView(context.workspaceId, cursor);
  });
}
export async function videoResultAction(workspaceId: unknown, id: unknown) {
  return videoActionResult(async () => {
    const context = await authorizeVideoWorkspace(workspaceId);
    const job = await findVideoGeneration({
      ...context,
      generationId: z.uuid().parse(id),
    });
    if (!job) throw new Error("Video not found.");
    return {
      job: videoGenerationSummary(job),
      url: await videoOutputUrl(context.workspaceId, job),
    };
  });
}
