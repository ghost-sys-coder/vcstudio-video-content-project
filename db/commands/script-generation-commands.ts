import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { scriptGenerationRuns, usageReservations } from "@/db/schema";
import { BudgetExceededError } from "@/lib/domain/errors";

/**
 * Atomically reserve budget and create a script-generation run, mirroring
 * `createSceneAnalysisReservation`: a single advisory-locked SQL statement
 * enforces project + workspace daily/monthly budgets and inserts the run plus a
 * `usage_reservations` row (`operation_type = 'script_generation'`,
 * `script_generation_id = run.id`) only when eligible.
 */
export async function createScriptGenerationReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
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
    throw new Error("INVALID_SCRIPT_GENERATION_BUDGET");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_SCRIPT_GENERATION_BUDGET_WINDOW");

  const result = await getDatabase().execute<{
    script_generation_id: string | null;
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
      insert into script_generation_runs (
        id, workspace_id, project_id, requested_by_user_id,
        idempotency_key, request_fingerprint, model, prompt_version,
        final_prompt, estimated_cost_cents
      )
      select
        ${input.id}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
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
        script_generation_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'script_generation'::usage_operation_type,
        inserted_run.id,
        ${input.estimatedCostCents},
        ${input.expiresAt}
      from inserted_run
      returning id
    )
    select
      (select id from inserted_run) as script_generation_id,
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
  if (row.script_generation_id && row.reservation_id) return;
  if (row.project_cents + input.estimatedCostCents > row.maximum_budget_cents)
    throw new BudgetExceededError("project");
  if (
    row.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new BudgetExceededError("workspace_daily");
  throw new BudgetExceededError("workspace_monthly");
}

/**
 * Cancel a script-generation run that has not started executing yet, releasing
 * its budget reservation. Mirrors `cancelSceneAudioGeneration`: a single locked
 * statement only transitions the run when it is still `pending`/`queued` and its
 * reservation is still `pending`, so no in-flight provider spend is stranded. The
 * run enum has no `cancelled` value, so it is marked `failed` with a `cancelled`
 * error category. If the run already reached `running`/`completed`/`failed`, this
 * is a no-op (`cancelled: false`) and the task's own preflight/early-return keep
 * billing correct.
 */
export async function cancelScriptGeneration(input: {
  workspaceId: string;
  projectId: string;
  scriptGenerationRunId: string;
}): Promise<{ cancelled: boolean }> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select run.id
      from script_generation_runs run
      inner join usage_reservations reservation
        on reservation.workspace_id = run.workspace_id
        and reservation.project_id = run.project_id
        and reservation.operation_type = 'script_generation'
        and reservation.script_generation_id = run.id
      where run.workspace_id = ${input.workspaceId}
        and run.project_id = ${input.projectId}
        and run.id = ${input.scriptGenerationRunId}
        and run.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of run, reservation
    ),
    transitioned_run as (
      update script_generation_runs run
      set
        status = 'failed'::scene_analysis_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'cancelled',
        safe_error_message = 'Script generation was cancelled before it started.',
        completed_at = now(),
        updated_at = now()
      from eligible
      where run.id = eligible.id
      returning run.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = 'released'::usage_reservation_status,
        actual_cost_cents = 0,
        updated_at = now()
      from transitioned_run
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'script_generation'
        and reservation.script_generation_id = transitioned_run.id
        and reservation.status = 'pending'
      returning reservation.id
    )
    select transitioned_run.id
    from transitioned_run
    inner join transitioned_reservation on true
  `);
  return { cancelled: result.rows.length === 1 };
}

export async function attachScriptGenerationTriggerRun(input: {
  scriptGenerationRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(scriptGenerationRuns)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(scriptGenerationRuns.id, input.scriptGenerationRunId));
}

export async function markScriptGenerationRunning(input: {
  scriptGenerationRunId: string;
  attemptCount: number;
}) {
  await getDatabase()
    .update(scriptGenerationRuns)
    .set({
      status: "running",
      progressPercent: 25,
      attemptCount: input.attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scriptGenerationRuns.id, input.scriptGenerationRunId));
}

export async function syncScriptGenerationRunning(input: {
  scriptGenerationRunId: string;
  workspaceId: string;
  projectId: string;
}) {
  await getDatabase()
    .update(scriptGenerationRuns)
    .set({ status: "running", progressPercent: 25, updatedAt: new Date() })
    .where(
      and(
        eq(scriptGenerationRuns.id, input.scriptGenerationRunId),
        eq(scriptGenerationRuns.workspaceId, input.workspaceId),
        eq(scriptGenerationRuns.projectId, input.projectId),
        eq(scriptGenerationRuns.status, "queued"),
      ),
    );
}

export async function completeScriptGeneration(input: {
  scriptGenerationRunId: string;
  workspaceId: string;
  projectId: string;
  generatedContent: string;
  suggestedTitle: string;
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(scriptGenerationRuns)
      .set({
        status: "completed",
        progressPercent: 100,
        generatedContent: input.generatedContent,
        suggestedTitle: input.suggestedTitle,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        actualCostCents: input.actualCostCents,
        providerRequestId: input.providerRequestId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(scriptGenerationRuns.id, input.scriptGenerationRunId)),
    getDatabase()
      .update(usageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(
        eq(usageReservations.scriptGenerationId, input.scriptGenerationRunId),
      ),
  ]);
}

export async function failScriptGeneration(input: {
  scriptGenerationRunId: string;
  category: string;
  message: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(scriptGenerationRuns)
      .set({
        status: "failed",
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(scriptGenerationRuns.id, input.scriptGenerationRunId)),
    getDatabase()
      .update(usageReservations)
      .set({ status: "released", actualCostCents: 0, updatedAt: now })
      .where(
        and(
          eq(usageReservations.scriptGenerationId, input.scriptGenerationRunId),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}
