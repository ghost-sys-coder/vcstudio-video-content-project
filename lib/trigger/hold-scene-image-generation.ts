import "server-only";

import { logger, tasks } from "@trigger.dev/sdk";
import { handOffSceneImageTriggerRun } from "@/db/commands/scene-image-commands";
import {
  createPromptTemplateHoldKey,
  decidePromptTemplateHold,
} from "@/lib/prompts/prompt-template-hold";
import type { sceneImageGenerationTask } from "@/trigger/scene-image-generation";

export type SceneImageHoldOutcome =
  | { outcome: "held"; attempt: number }
  | { outcome: "giveUp"; safeErrorMessage: string };

/**
 * Parks a generation whose prompt version this worker does not carry yet.
 *
 * Rather than failing the job, the worker dispatches the same job again on a
 * delay and hands the generation over to that new run. A run picks up whichever
 * worker version is current when it starts, so if the workers are deployed in
 * the meantime the replacement simply succeeds, and nobody has to notice or
 * redo anything.
 *
 * Lives outside the task file so the task can be referenced for its type
 * without the task importing itself.
 */
export async function holdSceneImageGenerationForPromptTemplate(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  currentTriggerRunId: string;
  attemptsSoFar: number;
  unknownVersion: string;
}): Promise<SceneImageHoldOutcome> {
  const decision = decidePromptTemplateHold({
    attemptsSoFar: input.attemptsSoFar,
  });
  if (decision.action === "giveUp")
    return {
      outcome: "giveUp",
      safeErrorMessage: decision.safeErrorMessage,
    };

  logger.warn("Prompt version is newer than this worker; holding the job", {
    generationId: input.generationId,
    version: input.unknownVersion,
    attempt: decision.attempt,
    delaySeconds: decision.delaySeconds,
  });

  const handle = await tasks.trigger<typeof sceneImageGenerationTask>(
    "scene-image-generation",
    {
      generationId: input.generationId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      promptTemplateHoldAttempt: decision.attempt,
    },
    {
      delay: `${decision.delaySeconds}s`,
      idempotencyKey: createPromptTemplateHoldKey({
        generationId: input.generationId,
        attempt: decision.attempt,
      }),
    },
  );

  // If the hand-off loses, another worker already moved this generation on, so
  // the job is in someone else's hands and this run must not also claim it.
  const handedOff = await handOffSceneImageTriggerRun({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationId: input.generationId,
    fromTriggerRunId: input.currentTriggerRunId,
    toTriggerRunId: handle.id,
  });
  if (!handedOff)
    logger.warn("Held generation was already handed to another run", {
      generationId: input.generationId,
    });

  return { outcome: "held", attempt: decision.attempt };
}
