import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectTitleSuggestions,
  titleGenerationRuns,
  usageReservations,
  type ContentPlatform,
} from "@/db/schema";
import { BudgetExceededError } from "@/lib/domain/errors";

/**
 * Atomically reserve budget and create a title-generation run, mirroring
 * `createScriptGenerationReservation`: a single advisory-locked SQL statement
 * enforces project + workspace daily/monthly budgets and inserts the run plus a
 * `usage_reservations` row (`operation_type = 'title_generation'`,
 * `title_generation_id = run.id`) only when eligible.
 */
export async function createTitleGenerationReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  platform: ContentPlatform;
  scriptVersionId: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  promptVersion: string;
  finalPrompt: string;
  requestedOptionCount: number;
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
    throw new Error("INVALID_TITLE_GENERATION_BUDGET");
  if (
    !Number.isInteger(input.requestedOptionCount) ||
    input.requestedOptionCount < 1
  )
    throw new Error("INVALID_TITLE_GENERATION_OPTION_COUNT");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_TITLE_GENERATION_BUDGET_WINDOW");

  const result = await getDatabase().execute<{
    title_generation_id: string | null;
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
      insert into title_generation_runs (
        id, workspace_id, project_id, requested_by_user_id, platform,
        script_version_id, idempotency_key, request_fingerprint, model,
        prompt_version, final_prompt, requested_option_count, estimated_cost_cents
      )
      select
        ${input.id}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        ${input.userId}::uuid,
        ${input.platform}::content_platform,
        ${input.scriptVersionId}::uuid,
        ${input.idempotencyKey},
        ${input.requestFingerprint},
        ${input.model},
        ${input.promptVersion},
        ${input.finalPrompt},
        ${input.requestedOptionCount},
        ${input.estimatedCostCents}
      from eligible
      returning id
    ),
    inserted_reservation as (
      insert into usage_reservations (
        id, workspace_id, project_id, operation_type,
        title_generation_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'title_generation'::usage_operation_type,
        inserted_run.id,
        ${input.estimatedCostCents},
        ${input.expiresAt}
      from inserted_run
      returning id
    )
    select
      (select id from inserted_run) as title_generation_id,
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
  if (row.title_generation_id && row.reservation_id) return;
  if (row.project_cents + input.estimatedCostCents > row.maximum_budget_cents)
    throw new BudgetExceededError("project");
  if (
    row.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new BudgetExceededError("workspace_daily");
  throw new BudgetExceededError("workspace_monthly");
}

export async function attachTitleGenerationTriggerRun(input: {
  titleGenerationRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(titleGenerationRuns)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(titleGenerationRuns.id, input.titleGenerationRunId));
}

export async function markTitleGenerationRunning(input: {
  titleGenerationRunId: string;
  attemptCount: number;
}) {
  await getDatabase()
    .update(titleGenerationRuns)
    .set({
      status: "running",
      progressPercent: 25,
      attemptCount: input.attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(titleGenerationRuns.id, input.titleGenerationRunId));
}

export async function syncTitleGenerationRunning(input: {
  titleGenerationRunId: string;
  workspaceId: string;
  projectId: string;
}) {
  await getDatabase()
    .update(titleGenerationRuns)
    .set({ status: "running", progressPercent: 25, updatedAt: new Date() })
    .where(
      and(
        eq(titleGenerationRuns.id, input.titleGenerationRunId),
        eq(titleGenerationRuns.workspaceId, input.workspaceId),
        eq(titleGenerationRuns.projectId, input.projectId),
        eq(titleGenerationRuns.status, "queued"),
      ),
    );
}

/**
 * Persist the generated options, mark the run complete, and reconcile the
 * reservation with actual spend — all in one batch so the ledger and the durable
 * output land together.
 */
export async function completeTitleGeneration(input: {
  titleGenerationRunId: string;
  workspaceId: string;
  projectId: string;
  platform: ContentPlatform;
  options: { text: string; rationale: string; hookType: string }[];
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
}) {
  const now = new Date();
  const database = getDatabase();
  const updateRun = database
    .update(titleGenerationRuns)
    .set({
      status: "completed",
      progressPercent: 100,
      resultOptionCount: input.options.length,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      actualCostCents: input.actualCostCents,
      providerRequestId: input.providerRequestId,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(titleGenerationRuns.id, input.titleGenerationRunId));
  const reconcile = database
    .update(usageReservations)
    .set({
      status: "reconciled",
      actualCostCents: input.actualCostCents,
      updatedAt: now,
    })
    .where(eq(usageReservations.titleGenerationId, input.titleGenerationRunId));
  if (input.options.length === 0) {
    await database.batch([updateRun, reconcile]);
    return;
  }
  const insertSuggestions = database.insert(projectTitleSuggestions).values(
    input.options.map((option, index) => ({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      titleGenerationRunId: input.titleGenerationRunId,
      platform: input.platform,
      text: option.text,
      rationale: option.rationale,
      hookType: option.hookType,
      position: index,
    })),
  );
  await database.batch([updateRun, reconcile, insertSuggestions]);
}

export async function failTitleGeneration(input: {
  titleGenerationRunId: string;
  category: string;
  message: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(titleGenerationRuns)
      .set({
        status: "failed",
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(titleGenerationRuns.id, input.titleGenerationRunId)),
    getDatabase()
      .update(usageReservations)
      .set({ status: "released", actualCostCents: 0, updatedAt: now })
      .where(
        and(
          eq(usageReservations.titleGenerationId, input.titleGenerationRunId),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}

/**
 * Cancel a title-generation run that has not started executing yet, releasing
 * its budget reservation. Mirrors `cancelScriptGeneration`.
 */
export async function cancelTitleGeneration(input: {
  workspaceId: string;
  projectId: string;
  titleGenerationRunId: string;
}): Promise<{ cancelled: boolean }> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select run.id
      from title_generation_runs run
      inner join usage_reservations reservation
        on reservation.workspace_id = run.workspace_id
        and reservation.project_id = run.project_id
        and reservation.operation_type = 'title_generation'
        and reservation.title_generation_id = run.id
      where run.workspace_id = ${input.workspaceId}
        and run.project_id = ${input.projectId}
        and run.id = ${input.titleGenerationRunId}
        and run.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of run, reservation
    ),
    transitioned_run as (
      update title_generation_runs run
      set
        status = 'failed'::scene_analysis_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'cancelled',
        safe_error_message = 'Title generation was cancelled before it started.',
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
        and reservation.operation_type = 'title_generation'
        and reservation.title_generation_id = transitioned_run.id
        and reservation.status = 'pending'
      returning reservation.id
    )
    select transitioned_run.id
    from transitioned_run
    inner join transitioned_reservation on true
  `);
  return { cancelled: result.rows.length === 1 };
}

/**
 * Toggle a suggestion's favorite flag. Workspace/project scoped so a browser
 * cannot flip favorites across tenants.
 */
export async function setTitleSuggestionFavorite(input: {
  workspaceId: string;
  projectId: string;
  suggestionId: string;
  isFavorite: boolean;
}): Promise<{ updated: boolean }> {
  const result = await getDatabase()
    .update(projectTitleSuggestions)
    .set({ isFavorite: input.isFavorite })
    .where(
      and(
        eq(projectTitleSuggestions.id, input.suggestionId),
        eq(projectTitleSuggestions.workspaceId, input.workspaceId),
        eq(projectTitleSuggestions.projectId, input.projectId),
      ),
    )
    .returning({ id: projectTitleSuggestions.id });
  return { updated: result.length === 1 };
}
