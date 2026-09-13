import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase, getNeonClient } from "@/db/drizzle";
import { scenes } from "@/db/schema";

/**
 * Removes a scene and closes the gap it leaves in the numbering.
 *
 * **Everything the scene owned goes with it, and the database does that part.**
 * Its versions, images, narration, clips, per-variant framing and any short
 * clip cut from it all cascade, so nothing here deletes them by hand and
 * nothing can be left orphaned by a list that fell out of date.
 *
 * **The renumbering is the part with a trap in it.** Scenes carry a unique
 * index on the analysis run and the scene number, so shifting every later scene
 * down by one passes through a moment where two rows want the same number.
 * Whether that moment is visible depends on the order Postgres happens to
 * update rows in, which depends on their physical order on disk. Tried against
 * the real database, `delete 3 then shift down` succeeded when the rows had
 * been inserted in order and failed with a duplicate key when they had not.
 * Relying on it would be a delete that works until the day it doesn't.
 *
 * So the later scenes are moved far out of the way first and brought back
 * afterwards. Neither move can collide: the first lands above every real
 * number, the second lands in a range the deletion has just emptied. The two
 * statements go as one transaction, because a crash between them would leave
 * scenes numbered in the millions.
 */

/**
 * Far above any real scene number and far below the integer ceiling.
 *
 * Scene numbers are positive by database constraint, so the parking range has
 * to be above the real ones rather than negative.
 */
const PARKING_OFFSET = 1_000_000;

export class SceneNotFoundError extends Error {
  constructor() {
    super("That scene is no longer available.");
    this.name = "SceneNotFoundError";
  }
}

export interface SceneDeletionResult {
  deletedSceneNumber: number;
  /** How many scenes the project has afterwards. */
  remainingSceneCount: number;
  /** Scene numbers that changed, so the interface can say what moved. */
  renumberedFrom: number;
}

export async function deleteSceneAndRenumber(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
}): Promise<SceneDeletionResult> {
  const [scene] = await getDatabase()
    .select({
      id: scenes.id,
      sceneNumber: scenes.sceneNumber,
    })
    .from(scenes)
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.id, input.sceneId),
      ),
    )
    .limit(1);
  if (!scene) throw new SceneNotFoundError();

  const client = getNeonClient();
  await client.transaction([
    // Delete, and move everything after it out of reach in the same breath.
    client`
      with removed as (
        delete from scenes
        where workspace_id = ${input.workspaceId}
          and project_id = ${input.projectId}
          and id = ${input.sceneId}
        returning scene_number
      )
      update scenes s
      set scene_number = s.scene_number + ${PARKING_OFFSET},
          updated_at = now()
      from removed r
      where s.workspace_id = ${input.workspaceId}
        and s.project_id = ${input.projectId}
        and s.scene_number > r.scene_number
    `,
    // Bring them back one lower than they were, into the gap.
    client`
      update scenes
      set scene_number = scene_number - ${PARKING_OFFSET} - 1,
          updated_at = now()
      where workspace_id = ${input.workspaceId}
        and project_id = ${input.projectId}
        and scene_number > ${PARKING_OFFSET}
    `,
  ]);

  const [remaining] = await getDatabase()
    .select({ count: sql<number>`count(*)::int` })
    .from(scenes)
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
      ),
    );

  return {
    deletedSceneNumber: scene.sceneNumber,
    remainingSceneCount: Number(remaining?.count ?? 0),
    renumberedFrom: scene.sceneNumber,
  };
}
