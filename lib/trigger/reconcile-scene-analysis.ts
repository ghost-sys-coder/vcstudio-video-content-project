import "server-only";

import { runs } from "@trigger.dev/sdk";
import {
  failSceneAnalysis,
  syncSceneAnalysisRunning,
} from "@/db/commands/scene-commands";
import {
  findSceneAnalysisRun,
  findUsageReservation,
} from "@/db/repositories/scenes.repository";
import {
  getTriggerRunDisposition,
  getTriggerRunFailure,
} from "@/lib/domain/trigger-run-status";

const activeLocalStatuses = new Set(["pending", "queued", "running"]);

export async function reconcileSceneAnalysisRun(input: {
  workspaceId: string;
  projectId: string;
  analysisRunId: string;
}): Promise<void> {
  const run = await findSceneAnalysisRun(input);
  if (!run) throw new Error("SCENE_ANALYSIS_RUN_NOT_FOUND");
  if (!activeLocalStatuses.has(run.status)) return;
  const reservation = await findUsageReservation(input);
  const reservationExpired = reservation
    ? reservation.expiresAt.getTime() <= Date.now()
    : true;
  if (!run.triggerRunId) {
    if (reservationExpired)
      await failSceneAnalysis({
        analysisRunId: run.id,
        category: "trigger_missing",
        message:
          "The scene-analysis workflow could not be located. You can retry the analysis.",
      });
    return;
  }
  let triggerRun: Awaited<ReturnType<typeof runs.retrieve>>;
  try {
    triggerRun = await runs.retrieve(run.triggerRunId);
  } catch {
    if (reservationExpired)
      await failSceneAnalysis({
        analysisRunId: run.id,
        category: "trigger_unavailable",
        message:
          "The scene-analysis workflow could not be verified before its reservation expired. You can retry the analysis.",
      });
    return;
  }
  const disposition = getTriggerRunDisposition(triggerRun.status);
  if (disposition === "failed") {
    await failSceneAnalysis({
      analysisRunId: run.id,
      ...getTriggerRunFailure({ status: triggerRun.status }),
    });
    return;
  }
  if (disposition === "completed") {
    await failSceneAnalysis({
      analysisRunId: run.id,
      category: "trigger_completion_mismatch",
      message:
        "The workflow completed without saving a scene plan. You can retry the analysis.",
    });
    return;
  }
  if (reservationExpired) {
    await failSceneAnalysis({
      analysisRunId: run.id,
      category: "trigger_stale",
      message:
        "The scene-analysis workflow did not complete before its reservation expired. You can retry the analysis.",
    });
    return;
  }
  if (triggerRun.status === "EXECUTING") await syncSceneAnalysisRunning(input);
}
