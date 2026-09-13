import "server-only";

import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { SceneNotFoundError } from "@/db/commands/scene-delete-commands";
import {
  mergeScenesAndRenumber,
  type SceneMergeCommandResult,
} from "@/db/commands/merge-scenes-command";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { cancelSceneTriggerRuns } from "@/lib/scenes/cancel-scene-trigger-runs";
import {
  planSceneMerge,
  type SceneMergeSide,
} from "@/lib/scenes/plan-scene-merge";
import { deleteSceneAssetObjects } from "@/lib/storage/scene-asset-storage";

export class SceneMergeRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneMergeRefusedError";
  }
}

function toSide(row: {
  scene: { id: string; sceneNumber: number; currentVersion: number };
  version: {
    narrationText: string;
    estimatedDurationMilliseconds: number;
    startTimeMilliseconds: number;
  };
}): SceneMergeSide {
  return {
    sceneId: row.scene.id,
    sceneNumber: row.scene.sceneNumber,
    currentVersion: row.scene.currentVersion,
    narrationText: row.version.narrationText,
    estimatedDurationMilliseconds: row.version.estimatedDurationMilliseconds,
    startTimeMilliseconds: row.version.startTimeMilliseconds,
  };
}

/**
 * Merges a scene into its neighbour for good.
 *
 * **Storage is purged before the rows change, for the same reason a deletion
 * does it in that order.** Both orderings can fail partway, so the question is
 * which failure is recoverable. This way, a storage failure leaves both scenes
 * exactly as they were and the creator tries again. The other way round, a
 * failure strands every object of a scene that no longer exists, invisible to
 * the application and billing forever.
 *
 * Purging the absorbed scene cannot take the survivor's images with it: media
 * is shared between versions by reference rather than by copying, and those
 * references never cross a scene boundary — the merge statement restates that
 * restriction where it reuses them. The absorbed scene's own prefix therefore
 * holds only the absorbed scene's files.
 */
export async function mergeScenesPermanently(input: {
  workspaceId: string;
  projectId: string;
  /** The scene that lives on, keeping its identity, brief and images. */
  survivorSceneId: string;
  /** The neighbour whose narration is absorbed and whose row is removed. */
  absorbedSceneId: string;
  actorUserId: string;
}): Promise<
  SceneMergeCommandResult & {
    deletedObjectCount: number;
    cancelledRunCount: number;
    absorbedSceneNumber: number;
  }
> {
  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  };
  const [survivorRow, absorbedRow] = await Promise.all([
    findCurrentScene({ ...scope, sceneId: input.survivorSceneId }),
    findCurrentScene({ ...scope, sceneId: input.absorbedSceneId }),
  ]);
  if (!survivorRow || !absorbedRow) throw new SceneNotFoundError();

  // Adjacency is checked here and again inside the merge statement. Here so the
  // refusal is a sentence rather than a conflict, and there so a scene that
  // moved between the two cannot slip through.
  const planned = planSceneMerge({
    survivor: toSide(survivorRow),
    absorbed: toSide(absorbedRow),
  });
  if (!planned.ok) throw new SceneMergeRefusedError(planned.message);

  const absorbedScope = { ...scope, sceneId: input.absorbedSceneId };
  // Stop the absorbed scene's work first, or a generation in flight uploads
  // after the purge and orphans its output under a scene about to vanish.
  const { cancelledCount } = await cancelSceneTriggerRuns(absorbedScope);
  const { deletedCount } = await deleteSceneAssetObjects(absorbedScope);

  const result = await mergeScenesAndRenumber({
    ...scope,
    previousVersionId: survivorRow.version.id,
    plan: planned.plan,
    userId: input.actorUserId,
  });

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    action: "scenes_merged",
    targetType: "scene",
    targetId: input.survivorSceneId,
    // The absorbed scene's row is gone, so its number is recorded here or the
    // history entry cannot say what was merged into what.
    metadata: {
      survivorSceneNumber: planned.plan.survivor.sceneNumber,
      absorbedSceneNumber: planned.plan.absorbed.sceneNumber,
      resultingSceneNumber: planned.plan.resultingSceneNumber,
      remainingSceneCount: result.remainingSceneCount,
      deletedObjectCount: deletedCount,
      cancelledRunCount: cancelledCount,
    },
  });

  return {
    ...result,
    deletedObjectCount: deletedCount,
    cancelledRunCount: cancelledCount,
    absorbedSceneNumber: planned.plan.absorbed.sceneNumber,
  };
}
