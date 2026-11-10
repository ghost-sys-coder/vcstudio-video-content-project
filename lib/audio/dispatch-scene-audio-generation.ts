import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { attachSceneAudioTriggerRun } from "@/db/commands/scene-audio-commands";
import type { sceneAudioGenerationTask } from "@/trigger/scene-audio-generation";
export async function dispatchSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  idempotencyKey: string;
}): Promise<boolean> {
  try {
    const handle = await tasks.trigger<typeof sceneAudioGenerationTask>(
      "scene-audio-generation",
      {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generationId: input.generationId,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    await attachSceneAudioTriggerRun({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
      triggerRunId: handle.id,
    });
    return true;
  } catch {
    return false;
  }
}
