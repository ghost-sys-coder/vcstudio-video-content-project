import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptVersions,
  projects,
  sceneAnalysisRuns,
  scenes,
  sceneVersions,
  sceneVersionCharacters,
  usageReservations,
} from "@/db/schema";
import type { SceneContent, SceneAnalysisOutput } from "@/lib/schemas/scene";
import { calculateSceneTimings } from "@/lib/domain/scene-timing";
import {
  findLatestCompletedSceneAnalysisRun,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { findProjectScriptVersion } from "@/db/repositories/projects.repository";
import { BudgetExceededError } from "@/lib/domain/errors";

export async function approveScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
}) {
  const target = await findProjectScriptVersion({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    versionId: input.scriptVersionId,
  });
  if (!target) throw new Error("Script version not found.");
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(projectScriptVersions)
      .set({ status: "superseded", approvedByUserId: null, approvedAt: null })
      .where(
        and(
          eq(projectScriptVersions.workspaceId, input.workspaceId),
          eq(projectScriptVersions.projectId, input.projectId),
          ne(projectScriptVersions.id, input.scriptVersionId),
          eq(projectScriptVersions.status, "approved"),
        ),
      ),
    getDatabase()
      .update(projectScriptVersions)
      .set({
        status: "approved",
        approvedByUserId: input.userId,
        approvedAt: now,
      })
      .where(
        and(
          eq(projectScriptVersions.workspaceId, input.workspaceId),
          eq(projectScriptVersions.projectId, input.projectId),
          eq(projectScriptVersions.id, input.scriptVersionId),
        ),
      ),
  ]);
}

export async function createSceneAnalysisReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  promptVersion: string;
  finalPrompt: string;
  estimatedCostCents: number;
  expiresAt: Date;
  budget: {
    workspaceDailyLimitCents: number;
    workspaceMonthlyLimitCents: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
  };
}) {
  const limits = [
    input.estimatedCostCents,
    input.budget.workspaceDailyLimitCents,
    input.budget.workspaceMonthlyLimitCents,
  ];
  if (limits.some((value) => !Number.isInteger(value) || value < 0))
    throw new Error("INVALID_SCENE_ANALYSIS_BUDGET");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_SCENE_ANALYSIS_BUDGET_WINDOW");

  const result = await getDatabase().execute<{
    analysis_run_id: string | null;
    reservation_id: string | null;
    maximum_budget_cents: number;
    project_cents: number;
    daily_cents: number;
    monthly_cents: number;
  }>(sql`
    with budget_lock as materialized (
      select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))
    ),
    committed as materialized (
      select
        coalesce(sum(
          case when ur.status = 'pending'
            then ur.reserved_cost_cents
            else coalesce(ur.actual_cost_cents, 0)
          end
        ) filter (where ur.project_id = ${input.projectId}), 0)::int as project_cents,
        coalesce(sum(
          case when ur.status = 'pending'
            then ur.reserved_cost_cents
            else coalesce(ur.actual_cost_cents, 0)
          end
        ) filter (where ur.created_at >= ${input.budget.dailyWindowStart}), 0)::int as daily_cents,
        coalesce(sum(
          case when ur.status = 'pending'
            then ur.reserved_cost_cents
            else coalesce(ur.actual_cost_cents, 0)
          end
        ) filter (where ur.created_at >= ${input.budget.monthlyWindowStart}), 0)::int as monthly_cents
      from budget_lock
      left join usage_reservations ur
        on ur.workspace_id = ${input.workspaceId}
        and ur.status in ('pending', 'reconciled')
    ),
    eligible as materialized (
      select 1
      from projects p
      cross join committed c
      where p.workspace_id = ${input.workspaceId}
        and p.id = ${input.projectId}
        and p.archived_at is null
        and c.project_cents + ${input.estimatedCostCents} <= p.maximum_budget_cents
        and c.daily_cents + ${input.estimatedCostCents} <= ${input.budget.workspaceDailyLimitCents}
        and c.monthly_cents + ${input.estimatedCostCents} <= ${input.budget.workspaceMonthlyLimitCents}
    ),
    inserted_run as (
      insert into scene_analysis_runs (
        id, workspace_id, project_id, script_version_id,
        requested_by_user_id, idempotency_key, request_fingerprint,
        model, prompt_version, final_prompt, estimated_cost_cents
      )
      select
        ${input.id}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        ${input.scriptVersionId}::uuid,
        ${input.userId}::uuid,
        ${input.idempotencyKey},
        ${input.requestFingerprint},
        ${input.model},
        ${input.promptVersion},
        ${input.finalPrompt},
        ${input.estimatedCostCents}
      from eligible
      returning id
    ),
    inserted_reservation as (
      insert into usage_reservations (
        id, workspace_id, project_id, operation_type,
        analysis_run_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'scene_analysis'::usage_operation_type,
        inserted_run.id,
        ${input.estimatedCostCents},
        ${input.expiresAt}
      from inserted_run
      returning id
    )
    select
      (select id from inserted_run) as analysis_run_id,
      (select id from inserted_reservation) as reservation_id,
      p.maximum_budget_cents,
      c.project_cents,
      c.daily_cents,
      c.monthly_cents
    from projects p
    cross join committed c
    where p.workspace_id = ${input.workspaceId}
      and p.id = ${input.projectId}
      and p.archived_at is null
  `);

  const row = result.rows[0];
  if (!row) throw new Error("PROJECT_NOT_FOUND");
  if (row.analysis_run_id && row.reservation_id) return;
  if (row.project_cents + input.estimatedCostCents > row.maximum_budget_cents)
    throw new BudgetExceededError("project");
  if (
    row.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new BudgetExceededError("workspace_daily");
  throw new BudgetExceededError("workspace_monthly");
}

export async function attachTriggerRun(input: {
  analysisRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(sceneAnalysisRuns.id, input.analysisRunId));
}

export async function markSceneAnalysisRunning(
  analysisRunId: string,
  attemptCount: number,
) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      status: "running",
      progressPercent: 20,
      attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sceneAnalysisRuns.id, analysisRunId));
}

export async function syncSceneAnalysisRunning(input: {
  analysisRunId: string;
  workspaceId: string;
  projectId: string;
}) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      status: "running",
      progressPercent: 20,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAnalysisRuns.id, input.analysisRunId),
        eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
        eq(sceneAnalysisRuns.projectId, input.projectId),
        eq(sceneAnalysisRuns.status, "queued"),
      ),
    );
}

export async function completeSceneAnalysis(input: {
  analysisRunId: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
  output: SceneAnalysisOutput;
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
  durationLimits: { minimum: number; maximum: number };
}) {
  const timedScenes = calculateSceneTimings(
    input.output.scenes,
    input.durationLimits,
  );
  const now = new Date();
  const sceneRows = timedScenes.map((_, index) => ({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    scriptVersionId: input.scriptVersionId,
    analysisRunId: input.analysisRunId,
    sceneNumber: index + 1,
  }));
  const versionRows = timedScenes.map((scene, index) => ({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneId: sceneRows[index]!.id,
    versionNumber: 1,
    ...scene,
    createdByUserId: input.userId,
  }));
  await getDatabase().batch([
    getDatabase().insert(scenes).values(sceneRows),
    getDatabase().insert(sceneVersions).values(versionRows),
    getDatabase()
      .update(sceneAnalysisRuns)
      .set({
        status: "completed",
        progressPercent: 100,
        providerRequestId: input.providerRequestId,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        actualCostCents: input.actualCostCents,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(sceneAnalysisRuns.id, input.analysisRunId)),
    getDatabase()
      .update(usageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(eq(usageReservations.analysisRunId, input.analysisRunId)),
    getDatabase()
      .update(projects)
      .set({ status: "planning", updatedAt: now })
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          eq(projects.id, input.projectId),
        ),
      ),
  ]);
}

export async function failSceneAnalysis(input: {
  analysisRunId: string;
  category: string;
  message: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(sceneAnalysisRuns)
      .set({
        status: "failed",
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(sceneAnalysisRuns.id, input.analysisRunId)),
    getDatabase()
      .update(usageReservations)
      .set({ status: "released", actualCostCents: 0, updatedAt: now })
      .where(
        and(
          eq(usageReservations.analysisRunId, input.analysisRunId),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}

export async function updateScene(
  input: SceneContent & {
    workspaceId: string;
    projectId: string;
    sceneId: string;
    expectedVersion: number;
    userId: string;
  },
) {
  const currentRows = await listCurrentScenes(input);
  const targetIndex = currentRows.findIndex(
    ({ scene }) => scene.id === input.sceneId,
  );
  const target = currentRows[targetIndex];
  if (!target || target.scene.currentVersion !== input.expectedVersion)
    throw new Error("SCENE_REVISION_CONFLICT");
  let cursor = target.version.startTimeMilliseconds;
  const affected = currentRows.slice(targetIndex).map((row, index) => {
    const content = index === 0 ? input : row.version;
    const startTimeMilliseconds = cursor;
    const endTimeMilliseconds = cursor + content.estimatedDurationMilliseconds;
    cursor = endTimeMilliseconds;
    return {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sceneId: row.scene.id,
      versionNumber: row.scene.currentVersion + 1,
      narrationText: content.narrationText,
      visualDescription: content.visualDescription,
      locationDescription: content.locationDescription,
      actionDescription: content.actionDescription,
      cameraShot: content.cameraShot,
      cameraAngle: content.cameraAngle,
      cameraMotion: content.cameraMotion,
      emotionalTone: content.emotionalTone,
      characterNames: content.characterNames,
      propNames: content.propNames,
      continuityNotes: content.continuityNotes,
      estimatedDurationMilliseconds: content.estimatedDurationMilliseconds,
      startTimeMilliseconds,
      endTimeMilliseconds,
      createdByUserId: input.userId,
    };
  });
  const updates = affected.map((version) =>
    getDatabase()
      .update(scenes)
      .set({
        currentVersion: version.versionNumber,
        status: "review",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scenes.workspaceId, input.workspaceId),
          eq(scenes.projectId, input.projectId),
          eq(scenes.id, version.sceneId),
          eq(scenes.currentVersion, version.versionNumber - 1),
        ),
      ),
  );
  const previousAssignments = await getDatabase()
    .select()
    .from(sceneVersionCharacters)
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, input.workspaceId),
        eq(sceneVersionCharacters.projectId, input.projectId),
        inArray(
          sceneVersionCharacters.sceneVersionId,
          currentRows.slice(targetIndex).map((row) => row.version.id),
        ),
      ),
    );
  const copiedAssignments = affected.flatMap((version, index) =>
    previousAssignments
      .filter(
        (assignment) =>
          assignment.sceneVersionId ===
          currentRows[targetIndex + index]?.version.id,
      )
      .map((assignment) => ({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sceneVersionId: version.id,
        characterId: assignment.characterId,
        assignedByUserId: input.userId,
      })),
  );
  await getDatabase().batch([
    getDatabase().insert(sceneVersions).values(affected),
    ...(copiedAssignments.length
      ? [getDatabase().insert(sceneVersionCharacters).values(copiedAssignments)]
      : []),
    ...updates,
  ]);
}

export async function approveScene(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  expectedVersion: number;
}) {
  const [scene] = await getDatabase()
    .update(scenes)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.id, input.sceneId),
        eq(scenes.currentVersion, input.expectedVersion),
      ),
    )
    .returning();
  if (!scene) throw new Error("SCENE_REVISION_CONFLICT");
}

export async function approveAllScenes(input: {
  workspaceId: string;
  projectId: string;
}) {
  const activeRun = await findLatestCompletedSceneAnalysisRun(input);
  if (!activeRun) throw new Error("No completed scene plan found.");
  const approved = await getDatabase()
    .update(scenes)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.analysisRunId, activeRun.id),
      ),
    )
    .returning({ id: scenes.id });
  if (!approved.length) throw new Error("No active scenes found.");
}
