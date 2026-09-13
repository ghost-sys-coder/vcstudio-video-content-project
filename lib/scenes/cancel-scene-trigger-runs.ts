import "server-only";

import { runs } from "@trigger.dev/sdk";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAudioGenerations,
  sceneImageGenerations,
  sceneVideoGenerations,
} from "@/db/schema";

/** Statuses meaning "this run may still write to the scene's storage prefix". */
const ACTIVE_STATUSES = ["pending", "queued", "running"];

/**
 * Cancels every Trigger.dev run still in flight for one scene.
 *
 * Called before the scene's stored objects are purged. Without it, an image,
 * narration or clip generation that is mid-flight would happily upload its
 * output *after* the purge, leaving an orphan in R2 that no database row points
 * at — exactly the wasted storage the deletion is meant to reclaim.
 *
 * Only the three scene-scoped generations are covered, because only they write
 * beneath the scene's prefix. A render or a publication belongs to the project
 * and writes elsewhere; cancelling those because one scene was deleted would
 * destroy work the creator did not ask to lose.
 *
 * Best-effort by design: a run that has already finished, expired, or never
 * dispatched will reject cancellation, and none of that should stop a deletion
 * the user has already confirmed.
 */
export async function cancelSceneTriggerRuns(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
}): Promise<{ cancelledCount: number }> {
  const database = getDatabase();

  /**
   * Columns are typed per table in Drizzle, so this takes the columns it needs
   * rather than the table itself — a table-shaped parameter would bind to
   * whichever table was named first and reject the rest.
   */
  const activeRunIds = (source: {
    table: PgTable;
    triggerRunId: PgColumn;
    workspaceId: PgColumn;
    projectId: PgColumn;
    sceneId: PgColumn;
    status: PgColumn;
  }) =>
    database
      .select({ triggerRunId: source.triggerRunId })
      .from(source.table)
      .where(
        and(
          eq(source.workspaceId, input.workspaceId),
          eq(source.projectId, input.projectId),
          eq(source.sceneId, input.sceneId),
          inArray(source.status, ACTIVE_STATUSES),
          isNotNull(source.triggerRunId),
        ),
      );

  const results = await Promise.all([
    activeRunIds({
      table: sceneImageGenerations,
      triggerRunId: sceneImageGenerations.triggerRunId,
      workspaceId: sceneImageGenerations.workspaceId,
      projectId: sceneImageGenerations.projectId,
      sceneId: sceneImageGenerations.sceneId,
      status: sceneImageGenerations.status,
    }),
    activeRunIds({
      table: sceneAudioGenerations,
      triggerRunId: sceneAudioGenerations.triggerRunId,
      workspaceId: sceneAudioGenerations.workspaceId,
      projectId: sceneAudioGenerations.projectId,
      sceneId: sceneAudioGenerations.sceneId,
      status: sceneAudioGenerations.status,
    }),
    activeRunIds({
      table: sceneVideoGenerations,
      triggerRunId: sceneVideoGenerations.triggerRunId,
      workspaceId: sceneVideoGenerations.workspaceId,
      projectId: sceneVideoGenerations.projectId,
      sceneId: sceneVideoGenerations.sceneId,
      status: sceneVideoGenerations.status,
    }),
  ]);

  const runIds = [
    ...new Set(
      results
        .flat()
        .map((row) => row.triggerRunId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  let cancelledCount = 0;
  for (const runId of runIds) {
    try {
      await runs.cancel(runId);
      cancelledCount += 1;
    } catch (error) {
      console.error("Failed to cancel Trigger run during scene deletion.", {
        sceneId: input.sceneId,
        runId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
  return { cancelledCount };
}
