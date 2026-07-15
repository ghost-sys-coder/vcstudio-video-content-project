import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptVersions,
  sceneAnalysisRuns,
  scenes,
  sceneVersions,
  usageReservations,
} from "@/db/schema";

export async function findApprovedScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  scriptVersionId?: string;
}) {
  const conditions = [
    eq(projectScriptVersions.workspaceId, input.workspaceId),
    eq(projectScriptVersions.projectId, input.projectId),
    eq(projectScriptVersions.status, "approved"),
    isNull(projectScriptVersions.deletedAt),
  ];
  if (input.scriptVersionId)
    conditions.push(eq(projectScriptVersions.id, input.scriptVersionId));
  const [version] = await getDatabase()
    .select()
    .from(projectScriptVersions)
    .where(and(...conditions))
    .orderBy(desc(projectScriptVersions.versionNumber))
    .limit(1);
  return version ?? null;
}

export async function findSceneAnalysisRun(input: {
  workspaceId: string;
  projectId: string;
  analysisRunId?: string;
  idempotencyKey?: string;
}) {
  const conditions = [
    eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
    eq(sceneAnalysisRuns.projectId, input.projectId),
  ];
  if (input.analysisRunId)
    conditions.push(eq(sceneAnalysisRuns.id, input.analysisRunId));
  if (input.idempotencyKey)
    conditions.push(eq(sceneAnalysisRuns.idempotencyKey, input.idempotencyKey));
  const [run] = await getDatabase()
    .select()
    .from(sceneAnalysisRuns)
    .where(and(...conditions))
    .limit(1);
  return run ?? null;
}

export async function findLatestSceneAnalysisRun(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [run] = await getDatabase()
    .select()
    .from(sceneAnalysisRuns)
    .where(
      and(
        eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
        eq(sceneAnalysisRuns.projectId, input.projectId),
      ),
    )
    .orderBy(desc(sceneAnalysisRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function findLatestCompletedSceneAnalysisRun(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [run] = await getDatabase()
    .select()
    .from(sceneAnalysisRuns)
    .where(
      and(
        eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
        eq(sceneAnalysisRuns.projectId, input.projectId),
        eq(sceneAnalysisRuns.status, "completed"),
      ),
    )
    .orderBy(desc(sceneAnalysisRuns.completedAt))
    .limit(1);
  return run ?? null;
}

export async function findUsageReservation(input: {
  workspaceId: string;
  projectId: string;
  analysisRunId: string;
}) {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.analysisRunId, input.analysisRunId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function getProjectCommittedCostCents(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [result] = await getDatabase()
    .select({
      value: sql<number>`coalesce(sum(case when ${usageReservations.status} = 'pending' then ${usageReservations.reservedCostCents} else coalesce(${usageReservations.actualCostCents}, 0) end), 0)::int`,
    })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        inArray(usageReservations.status, ["pending", "reconciled"]),
      ),
    );
  return result?.value ?? 0;
}

export async function getWorkspaceCommittedCostCents(input: {
  workspaceId: string;
  since: Date;
}) {
  const [result] = await getDatabase()
    .select({
      value: sql<number>`coalesce(sum(case when ${usageReservations.status} = 'pending' then ${usageReservations.reservedCostCents} else coalesce(${usageReservations.actualCostCents}, 0) end), 0)::int`,
    })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        gte(usageReservations.createdAt, input.since),
        inArray(usageReservations.status, ["pending", "reconciled"]),
      ),
    );
  return result?.value ?? 0;
}

export async function listCurrentScenes(input: {
  workspaceId: string;
  projectId: string;
}) {
  const latestCompletedRun = await findLatestCompletedSceneAnalysisRun(input);
  if (!latestCompletedRun) return [];
  return getDatabase()
    .select({ scene: scenes, version: sceneVersions })
    .from(scenes)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.sceneId, scenes.id),
        eq(sceneVersions.versionNumber, scenes.currentVersion),
      ),
    )
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.analysisRunId, latestCompletedRun.id),
      ),
    )
    .orderBy(asc(scenes.sceneNumber));
}

export async function findCurrentScene(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
}) {
  const [result] = await getDatabase()
    .select({ scene: scenes, version: sceneVersions })
    .from(scenes)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.sceneId, scenes.id),
        eq(sceneVersions.versionNumber, scenes.currentVersion),
      ),
    )
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.id, input.sceneId),
      ),
    )
    .limit(1);
  return result ?? null;
}
