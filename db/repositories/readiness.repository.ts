import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  googleBusinessConnections,
  platformConnections,
  taskHeartbeats,
} from "@/db/schema";

export async function upsertTaskHeartbeat(input: {
  taskId: string;
  environment: string;
  startedAt: Date;
  completedAt: Date | null;
  outcome: "running" | "succeeded" | "failed";
  safeMessage: string | null;
}): Promise<void> {
  await getDatabase()
    .insert(taskHeartbeats)
    .values({
      taskId: input.taskId,
      environment: input.environment,
      lastStartedAt: input.startedAt,
      lastCompletedAt: input.completedAt,
      outcome: input.outcome,
      safeMessage: input.safeMessage,
    })
    .onConflictDoUpdate({
      target: [taskHeartbeats.taskId, taskHeartbeats.environment],
      set: {
        lastStartedAt: input.startedAt,
        lastCompletedAt: input.completedAt,
        outcome: input.outcome,
        safeMessage: input.safeMessage,
        updatedAt: new Date(),
      },
    });
}

export async function loadReadinessDatabaseSnapshot(input: {
  workspaceId: string;
  environment: string;
  staleBefore: Date;
}) {
  const database = getDatabase();
  const [heartbeat, connections, googleBusiness, stuck, schema] =
    await Promise.all([
      database
        .select()
        .from(taskHeartbeats)
        .where(
          and(
            eq(taskHeartbeats.taskId, "operational-readiness-heartbeat"),
            eq(taskHeartbeats.environment, input.environment),
          ),
        )
        .orderBy(desc(taskHeartbeats.updatedAt))
        .limit(1),
      database
        .select({
          platform: platformConnections.platform,
          status: platformConnections.status,
          expiresAt: platformConnections.accessTokenExpiresAt,
          lastError: platformConnections.lastError,
        })
        .from(platformConnections)
        .where(eq(platformConnections.workspaceId, input.workspaceId)),
      database
        .select({
          status: googleBusinessConnections.status,
          syncStatus: googleBusinessConnections.syncStatus,
          expiresAt: googleBusinessConnections.accessTokenExpiresAt,
          lastSyncedAt: googleBusinessConnections.lastSyncedAt,
          lastError: googleBusinessConnections.lastError,
        })
        .from(googleBusinessConnections)
        .where(eq(googleBusinessConnections.workspaceId, input.workspaceId))
        .limit(1),
      database.execute<{
        count: number;
      }>(sql`select count(*)::int as count from (
      select id from scene_analysis_runs where workspace_id = ${input.workspaceId} and status in ('pending','queued','running') and updated_at < ${input.staleBefore}
      union all select id from scene_image_generations where workspace_id = ${input.workspaceId} and status in ('pending','queued','running') and updated_at < ${input.staleBefore}
      union all select id from scene_audio_generations where workspace_id = ${input.workspaceId} and status in ('pending','queued','running') and updated_at < ${input.staleBefore}
      union all select id from video_renders where workspace_id = ${input.workspaceId} and status in ('pending','queued','running') and updated_at < ${input.staleBefore}
    ) active`),
      database.execute<{ present: boolean }>(
        sql`select to_regclass('public.task_heartbeats') is not null and to_regclass('public.storage_reconciliation_checkpoints') is not null as present`,
      ),
    ]);
  return {
    heartbeat: heartbeat[0] ?? null,
    connections,
    googleBusiness: googleBusiness[0] ?? null,
    stuckCount: stuck.rows[0]?.count ?? 0,
    schemaCompatible: schema.rows[0]?.present === true,
  };
}
