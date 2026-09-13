import "server-only";

import {
  deleteSceneAndRenumber,
  requireSceneForDeletion,
  type SceneDeletionResult,
} from "@/db/commands/scene-delete-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { cancelSceneTriggerRuns } from "@/lib/scenes/cancel-scene-trigger-runs";
import { deleteSceneAssetObjects } from "@/lib/storage/scene-asset-storage";

/**
 * Deletes a scene for good: its in-flight work, then its stored files, then its
 * rows and the gap it leaves in the numbering.
 *
 * **Storage is purged before the rows are deleted, deliberately.** Both
 * orderings can fail partway, so the question is which failure is recoverable:
 *
 * - Purge first: a storage failure leaves the scene fully intact and the
 *   creator simply tries again. If the purge succeeds but the row delete fails,
 *   the scene is still listed with its images missing, and a retry finishes the
 *   job — the purge is idempotent, so re-running it costs nothing.
 * - Rows first: a storage failure strands every object of a scene that no
 *   longer exists. Nothing in the application can name them again, and they
 *   bill forever.
 *
 * The second failure is invisible and permanent, so it is the one worth
 * designing out — reclaiming that storage being the whole point.
 */
export async function deleteScenePermanently(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  actorUserId: string;
}): Promise<
  SceneDeletionResult & {
    deletedObjectCount: number;
    cancelledRunCount: number;
  }
> {
  // Establish the scene is really this workspace's before touching its files.
  // Throws `SceneNotFoundError`, which the caller turns into a plain message.
  const scene = await requireSceneForDeletion(input);

  // Stop anything still running first: an image or clip generation in flight
  // would otherwise upload after the purge and immediately re-orphan storage.
  const { cancelledCount } = await cancelSceneTriggerRuns(input);

  const { deletedCount } = await deleteSceneAssetObjects(input);

  const result = await deleteSceneAndRenumber(input);

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    action: "scene_deleted",
    targetType: "scene",
    targetId: input.sceneId,
    // The scene row is gone, so its number is recorded here or the history
    // entry is an unresolvable UUID.
    metadata: {
      sceneNumber: scene.sceneNumber,
      remainingSceneCount: result.remainingSceneCount,
      deletedObjectCount: deletedCount,
      cancelledRunCount: cancelledCount,
    },
  });

  return {
    ...result,
    deletedObjectCount: deletedCount,
    cancelledRunCount: cancelledCount,
  };
}
