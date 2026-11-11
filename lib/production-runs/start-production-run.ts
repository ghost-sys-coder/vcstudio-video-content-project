import "server-only";

import { randomUUID } from "node:crypto";
import { runs, tasks } from "@trigger.dev/sdk";
import type { Project } from "@/db/schema";
import {
  attachProductionRunTrigger,
  appendProductionRunEvent,
  cancelProductionRun as cancelProductionRunRow,
  createProductionRun,
  failStoppedProductionRun,
  resumeProductionRun as resumeProductionRunRow,
} from "@/db/commands/production-run-commands";
import {
  findOpenProductionRun,
  findProductionRun,
} from "@/db/repositories/production-runs.repository";
import {
  findDefaultVoicePreset,
  findVoicePreset,
} from "@/db/repositories/scene-audio.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getProductionRunEnvironment } from "@/lib/env/server";
import {
  PRODUCTION_RUN_POLICY_VERSION,
  type ProductionRunPolicy,
} from "@/lib/production-runs/production-run-policy";
import {
  canCancelProductionRun,
  canResumeProductionRun,
  type ProductionRunStage,
} from "@/lib/production-runs/production-run-state";
import type { StartProductionRunInput } from "@/lib/schemas/production-run";
import type { productionRunTask } from "@/trigger/production-run";

export class ProductionRunRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionRunRequestError";
  }
}

const TASK_ID = "production-run";

async function dispatch(input: {
  workspaceId: string;
  runId: string;
  projectId: string;
}) {
  const handle = await tasks.trigger<typeof productionRunTask>(
    TASK_ID,
    { workspaceId: input.workspaceId, runId: input.runId },
    {
      idempotencyKey: `production-run:${input.runId}:${Date.now()}`,
      // One worker per project at a time, however many runs are queued.
      concurrencyKey: input.projectId,
    },
  );
  await attachProductionRunTrigger({
    workspaceId: input.workspaceId,
    runId: input.runId,
    triggerRunId: handle.id,
  });
}

/**
 * Starts an unattended run for a project.
 *
 * Refuses, with a reason the creator can act on, rather than starting a run
 * that would hold on its first step: no worker, a video-footage project, a
 * voice that does not exist, or a ceiling above the project's own budget.
 */
export async function startProductionRun(input: {
  workspaceId: string;
  project: Project;
  requestedByUserId: string;
  request: StartProductionRunInput;
}): Promise<{ runId: string }> {
  const environment = getProductionRunEnvironment();
  if (!environment.ENABLE_PRODUCTION_RUNS)
    throw new ProductionRunRequestError(
      "Production runs are not enabled in this deployment.",
    );
  const { project, request } = input;
  if (project.status === "archived")
    throw new ProductionRunRequestError("This project is archived.");
  if (project.defaultVisualMedia !== "image")
    throw new ProductionRunRequestError(
      "Production runs currently support still-image projects. Video-footage scenes still need you to choose or generate each clip.",
    );

  const open = await findOpenProductionRun({
    workspaceId: input.workspaceId,
    projectId: project.id,
  });
  if (open)
    throw new ProductionRunRequestError(
      "A production run is already open for this project. Cancel or resume it first.",
    );

  const voice = request.voicePresetId
    ? await findVoicePreset({
        workspaceId: input.workspaceId,
        voicePresetId: request.voicePresetId,
      })
    : await findDefaultVoicePreset({ workspaceId: input.workspaceId });
  if (!voice)
    throw new ProductionRunRequestError(
      request.voicePresetId
        ? "That voice preset is unavailable."
        : "Choose a voice for this run, or set a workspace default voice first.",
    );

  const maximumCostCents = Math.round(request.maximumCostDollars * 100);
  if (maximumCostCents > project.maximumBudgetCents)
    throw new ProductionRunRequestError(
      "The run's spending ceiling cannot exceed the project budget.",
    );

  const policy: ProductionRunPolicy = {
    version: PRODUCTION_RUN_POLICY_VERSION,
    stages: {
      script: request.scriptMode,
      scenes: request.scenesMode,
      images: request.imagesMode,
      audio: request.audioMode,
      render: request.renderMode,
    },
    imageQuality: request.imageQuality,
    voicePresetId: voice.id,
    maximumCostCents,
    maximumStageAttempts: request.retryFailedStages,
  };

  const runId = randomUUID();
  const stage: ProductionRunStage = "script";
  await createProductionRun({
    id: runId,
    workspaceId: input.workspaceId,
    projectId: project.id,
    requestedByUserId: input.requestedByUserId,
    policy,
    stage,
  });
  await appendProductionRunEvent({
    workspaceId: input.workspaceId,
    runId,
    stage,
    kind: "run_started",
    message: `Run started with a ${(maximumCostCents / 100).toFixed(2)} dollar ceiling.`,
    metadata: { maximumCostCents, imageQuality: policy.imageQuality },
  });
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.requestedByUserId,
    projectId: project.id,
    action: "production_run_started",
    targetType: "production_run",
    targetId: runId,
    metadata: { maximumCostCents, imageQuality: policy.imageQuality },
  });

  try {
    await dispatch({
      workspaceId: input.workspaceId,
      runId,
      projectId: project.id,
    });
  } catch (error) {
    // Nothing has been reserved yet, so a failed hand-off is a clean failure
    // rather than a stuck row owning the project.
    await failStoppedProductionRun({
      workspaceId: input.workspaceId,
      runId,
      safeErrorMessage: "The run could not be queued. Please try again.",
    });
    console.error("Failed to dispatch production run.", {
      runId,
      message: error instanceof Error ? error.message : "unknown error",
    });
    throw new ProductionRunRequestError(
      "The run could not be queued. Please try again.",
    );
  }
  return { runId };
}

/** Picks a held run back up from the stage it stopped at. */
export async function resumeHeldProductionRun(input: {
  workspaceId: string;
  projectId: string;
  runId: string;
  actorUserId: string;
}): Promise<void> {
  if (!getProductionRunEnvironment().ENABLE_PRODUCTION_RUNS)
    throw new ProductionRunRequestError(
      "Production runs are not enabled in this deployment.",
    );
  const run = await findProductionRun(input);
  if (!run || run.projectId !== input.projectId)
    throw new ProductionRunRequestError("That run is unavailable.");
  if (!canResumeProductionRun(run.status))
    throw new ProductionRunRequestError("Only a held run can be resumed.");
  const resumed = await resumeProductionRunRow(input);
  if (!resumed)
    throw new ProductionRunRequestError("That run already moved on.");
  await appendProductionRunEvent({
    workspaceId: input.workspaceId,
    runId: run.id,
    stage: run.stage,
    kind: "resumed",
    message: "Resumed by a workspace member.",
  });
  try {
    await dispatch({
      workspaceId: input.workspaceId,
      runId: run.id,
      projectId: run.projectId,
    });
  } catch (error) {
    await failStoppedProductionRun({
      workspaceId: input.workspaceId,
      runId: run.id,
      safeErrorMessage: "The run could not be queued again. Please try again.",
    });
    console.error("Failed to dispatch resumed production run.", {
      runId: run.id,
      message: error instanceof Error ? error.message : "unknown error",
    });
    throw new ProductionRunRequestError(
      "The run could not be queued again. Please try again.",
    );
  }
}

/**
 * Stops a run. Stage work already dispatched (an image batch, a render)
 * carries on under its own cancellation controls; the run simply stops
 * starting new work and stops approving anything.
 */
export async function cancelOpenProductionRun(input: {
  workspaceId: string;
  projectId: string;
  runId: string;
  actorUserId: string;
}): Promise<void> {
  const run = await findProductionRun(input);
  if (!run || run.projectId !== input.projectId)
    throw new ProductionRunRequestError("That run is unavailable.");
  if (!canCancelProductionRun(run.status))
    throw new ProductionRunRequestError("This run has already finished.");
  const cancelled = await cancelProductionRunRow(input);
  if (!cancelled)
    throw new ProductionRunRequestError("That run already moved on.");
  if (run.triggerRunId) {
    try {
      await runs.cancel(run.triggerRunId);
    } catch (error) {
      // The row is already cancelled, which is what the worker checks before
      // every step; a failed cancel of the live run only costs one more poll.
      console.error("Failed to cancel Trigger run for production run.", {
        runId: run.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
  await appendProductionRunEvent({
    workspaceId: input.workspaceId,
    runId: run.id,
    stage: run.stage,
    kind: "cancelled",
    message:
      "Cancelled by a workspace member. Work already dispatched finishes under its own controls.",
  });
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    action: "production_run_cancelled",
    targetType: "production_run",
    targetId: run.id,
    metadata: { stage: run.stage, spentCents: run.spentCostCents },
  });
}
