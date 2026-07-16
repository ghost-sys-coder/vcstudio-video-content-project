import "server-only";

import { runs, tasks } from "@trigger.dev/sdk";
import {
  attachSceneImageTriggerRun,
  failSceneImageGeneration,
  syncSceneImageGenerationRunning,
} from "@/db/commands/scene-image-commands";
import { findSceneImageGenerationWorkflowContext } from "@/db/repositories/scene-images.repository";
import { getSceneImageReconciliationDecision } from "@/lib/domain/scene-image-reconciliation";
import {
  failSceneImageWithConservativeProviderOutcome,
  recoverStoredSceneImage,
  type SceneImageWorkflowScope,
} from "@/lib/trigger/scene-image-recovery";
import type { sceneImageGenerationTask } from "@/trigger/scene-image-generation";

function providerRequestMayBeBillable(
  request: NonNullable<
    Awaited<ReturnType<typeof findSceneImageGenerationWorkflowContext>>
  >["latestProviderRequest"],
): boolean {
  if (!request) return false;
  return (
    request.status === "pending" ||
    request.status === "running" ||
    request.status === "succeeded" ||
    (request.actualCostCents ?? 0) > 0
  );
}

function failurePresentation(input: {
  reason:
    | "trigger_missing"
    | "trigger_unavailable"
    | "trigger_failed"
    | "trigger_completion_mismatch"
    | "reservation_expired";
  triggerStatus: string | null;
}) {
  if (input.reason === "trigger_missing")
    return {
      category: "trigger_missing",
      safeErrorMessage:
        "The scene-image workflow could not be located before its reservation expired. Generate a new version to try again.",
    };
  if (input.reason === "trigger_unavailable")
    return {
      category: "trigger_unavailable",
      safeErrorMessage:
        "The scene-image workflow could not be verified before its reservation expired. Generate a new version to try again.",
    };
  if (input.reason === "trigger_completion_mismatch")
    return {
      category: "trigger_completion_mismatch",
      safeErrorMessage:
        "The scene-image workflow completed without saving an image. Generate a new version to try again.",
    };
  if (input.reason === "reservation_expired")
    return {
      category: "trigger_stale",
      safeErrorMessage:
        "The scene-image workflow did not finish before its reservation expired. Generate a new version to try again.",
    };

  const normalizedStatus = input.triggerStatus?.toLowerCase() ?? "failed";
  return {
    category: `trigger_${normalizedStatus}`,
    safeErrorMessage:
      input.triggerStatus === "CRASHED"
        ? "The scene-image worker crashed before it could save an image. Generate a new version to try again."
        : "The scene-image workflow ended before it could save an image. Generate a new version to try again.",
  };
}

export async function reconcileSceneImageGeneration(
  scope: SceneImageWorkflowScope,
): Promise<void> {
  const context = await findSceneImageGenerationWorkflowContext(scope);
  if (!context) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  const { generation, reservation, latestProviderRequest } = context;
  if (
    generation.status === "succeeded" ||
    generation.status === "failed" ||
    generation.status === "cancelled"
  )
    return;

  const recovered = await recoverStoredSceneImage({
    scope,
    generation,
    latestProviderRequest,
  });
  if (recovered) return;

  const reservationExpired =
    !reservation ||
    reservation.status !== "pending" ||
    reservation.expiresAt.getTime() <= Date.now();
  let trigger:
    | { kind: "missing" }
    | { kind: "unavailable" }
    | { kind: "found"; status: string };
  if (!generation.triggerRunId) {
    trigger = { kind: "missing" };
  } else {
    try {
      const triggerRun = await runs.retrieve(generation.triggerRunId);
      trigger = { kind: "found", status: triggerRun.status };
    } catch {
      trigger = { kind: "unavailable" };
    }
  }

  if (trigger.kind === "missing" && !reservationExpired) {
    try {
      const handle = await tasks.trigger<typeof sceneImageGenerationTask>(
        "scene-image-generation",
        {
          generationId: generation.id,
          workspaceId: generation.workspaceId,
          projectId: generation.projectId,
        },
        { idempotencyKey: generation.idempotencyKey },
      );
      await attachSceneImageTriggerRun({
        ...scope,
        triggerRunId: handle.id,
      });
    } catch {
      return;
    }
    return;
  }

  const decision = getSceneImageReconciliationDecision({
    localStatus: generation.status,
    reservationExpired,
    trigger,
    providerRequestMayBeBillable: providerRequestMayBeBillable(
      latestProviderRequest,
    ),
  });
  if (decision.action === "none" || decision.action === "wait") return;
  if (decision.action === "sync_running") {
    await syncSceneImageGenerationRunning(scope);
    return;
  }

  const presentation = failurePresentation({
    reason: decision.reason,
    triggerStatus: trigger.kind === "found" ? trigger.status : null,
  });
  if (decision.chargeConservatively && latestProviderRequest) {
    await failSceneImageWithConservativeProviderOutcome({
      scope,
      providerRequest: latestProviderRequest,
      reservedCostCents:
        reservation?.reservedCostCents ?? generation.estimatedCostCents,
      ...presentation,
    });
    return;
  }

  await failSceneImageGeneration({
    ...scope,
    attemptNumber: latestProviderRequest?.attemptNumber,
    ...presentation,
  });
}
