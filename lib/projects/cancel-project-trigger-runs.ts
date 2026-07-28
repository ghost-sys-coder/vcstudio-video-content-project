import "server-only";

import { runs } from "@trigger.dev/sdk";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAnalysisRuns,
  sceneAudioGenerations,
  sceneImageGenerations,
  scriptGenerationRuns,
  thumbnailGenerations,
  titleGenerationRuns,
  videoPublications,
  videoRenders,
} from "@/db/schema";

/** Statuses meaning "this run may still write to storage". */
const ACTIVE_STATUSES = ["pending", "queued", "running"];
const ACTIVE_PUBLICATION_STATUSES = [
  "pending",
  "queued",
  "uploading",
  "processing",
];

/**
 * Cancels every Trigger.dev run still in flight for a project.
 *
 * Called before a project's stored assets are purged. Without this, a render or
 * image generation that is mid-flight would happily upload its output *after*
 * the purge, leaving an orphan in R2 that no database row points at — exactly
 * the wasted storage deletion is meant to reclaim.
 *
 * Best-effort by design: a run that has already finished, expired, or never
 * dispatched will reject cancellation, and none of that should stop a deletion
 * the user has already confirmed.
 */
export async function cancelProjectTriggerRuns(input: {
  workspaceId: string;
  projectId: string;
}): Promise<{ cancelledCount: number }> {
  const database = getDatabase();

  /**
   * Columns are typed per table in Drizzle, so this takes the four columns it
   * needs rather than the table itself — a table-shaped parameter would bind to
   * whichever table was named first and reject the rest.
   */
  const activeRunIds = (source: {
    table: PgTable;
    triggerRunId: PgColumn;
    projectId: PgColumn;
    workspaceId: PgColumn;
    status: PgColumn;
    statuses: string[];
  }) =>
    database
      .select({ triggerRunId: source.triggerRunId })
      .from(source.table)
      .where(
        and(
          eq(source.projectId, input.projectId),
          eq(source.workspaceId, input.workspaceId),
          inArray(source.status, source.statuses),
          isNotNull(source.triggerRunId),
        ),
      );

  const results = await Promise.all([
    activeRunIds({
      table: sceneImageGenerations,
      triggerRunId: sceneImageGenerations.triggerRunId,
      projectId: sceneImageGenerations.projectId,
      workspaceId: sceneImageGenerations.workspaceId,
      status: sceneImageGenerations.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: sceneAudioGenerations,
      triggerRunId: sceneAudioGenerations.triggerRunId,
      projectId: sceneAudioGenerations.projectId,
      workspaceId: sceneAudioGenerations.workspaceId,
      status: sceneAudioGenerations.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: thumbnailGenerations,
      triggerRunId: thumbnailGenerations.triggerRunId,
      projectId: thumbnailGenerations.projectId,
      workspaceId: thumbnailGenerations.workspaceId,
      status: thumbnailGenerations.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: titleGenerationRuns,
      triggerRunId: titleGenerationRuns.triggerRunId,
      projectId: titleGenerationRuns.projectId,
      workspaceId: titleGenerationRuns.workspaceId,
      status: titleGenerationRuns.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: scriptGenerationRuns,
      triggerRunId: scriptGenerationRuns.triggerRunId,
      projectId: scriptGenerationRuns.projectId,
      workspaceId: scriptGenerationRuns.workspaceId,
      status: scriptGenerationRuns.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: sceneAnalysisRuns,
      triggerRunId: sceneAnalysisRuns.triggerRunId,
      projectId: sceneAnalysisRuns.projectId,
      workspaceId: sceneAnalysisRuns.workspaceId,
      status: sceneAnalysisRuns.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: videoRenders,
      triggerRunId: videoRenders.triggerRunId,
      projectId: videoRenders.projectId,
      workspaceId: videoRenders.workspaceId,
      status: videoRenders.status,
      statuses: ACTIVE_STATUSES,
    }),
    activeRunIds({
      table: videoPublications,
      triggerRunId: videoPublications.triggerRunId,
      projectId: videoPublications.projectId,
      workspaceId: videoPublications.workspaceId,
      status: videoPublications.status,
      statuses: ACTIVE_PUBLICATION_STATUSES,
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
      console.error("Failed to cancel Trigger run during project deletion.", {
        projectId: input.projectId,
        runId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
  return { cancelledCount };
}
