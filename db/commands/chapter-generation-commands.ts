import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  chapterGenerationRuns,
  usageReservations,
  videoRenderChapters,
} from "@/db/schema";
import type { VideoChapter } from "@/lib/chapters/youtube-chapters";
import { BudgetExceededError } from "@/lib/domain/errors";

/**
 * Atomically reserve budget and create a chapter-generation run, mirroring
 * `createTitleGenerationReservation`: one advisory-locked statement enforces the
 * project and workspace daily/monthly budgets and inserts the run plus its
 * `usage_reservations` row (`operation_type = 'chapter_generation'`) only when
 * eligible. The render must belong to the same project and workspace, which
 * the tenant foreign key enforces as well.
 */
export async function createChapterGenerationReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  renderId: string;
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
    throw new Error("INVALID_CHAPTER_GENERATION_BUDGET");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_CHAPTER_GENERATION_BUDGET_WINDOW");

  const result = await getDatabase().execute<{
    chapter_generation_id: string | null;
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
      insert into chapter_generation_runs (
        id, workspace_id, project_id, render_id, requested_by_user_id,
        idempotency_key, request_fingerprint, model, prompt_version,
        final_prompt, estimated_cost_cents
      )
      select
        ${input.id}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        ${input.renderId}::uuid,
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
        chapter_generation_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'chapter_generation'::usage_operation_type,
        inserted_run.id,
        ${input.estimatedCostCents},
        ${input.expiresAt}
      from inserted_run
      returning id
    )
    select
      (select id from inserted_run) as chapter_generation_id,
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
  if (row.chapter_generation_id && row.reservation_id) return;
  if (row.project_cents + input.estimatedCostCents > row.maximum_budget_cents)
    throw new BudgetExceededError("project");
  if (
    row.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new BudgetExceededError("workspace_daily");
  throw new BudgetExceededError("workspace_monthly");
}

export async function attachChapterGenerationTriggerRun(input: {
  chapterGenerationRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(chapterGenerationRuns)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(chapterGenerationRuns.id, input.chapterGenerationRunId));
}

export async function markChapterGenerationRunning(input: {
  chapterGenerationRunId: string;
  attemptCount: number;
}) {
  await getDatabase()
    .update(chapterGenerationRuns)
    .set({
      status: "running",
      progressPercent: 25,
      attemptCount: input.attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chapterGenerationRuns.id, input.chapterGenerationRunId));
}

/**
 * Record the result, reconcile the reservation, and make the chapters the
 * render's current ones — in one batch, so spend and output land together.
 *
 * A fresh generation replaces the render's chapters, including any edits, and
 * raises the version so an editor still holding the old list cannot save over
 * it. Whether chapters go into the description is the person's choice and is
 * left as it was.
 */
export async function completeChapterGeneration(input: {
  chapterGenerationRunId: string;
  workspaceId: string;
  projectId: string;
  renderId: string;
  userId: string;
  chapters: VideoChapter[];
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
}) {
  const now = new Date();
  const database = getDatabase();
  await database.batch([
    database
      .update(chapterGenerationRuns)
      .set({
        status: "completed",
        progressPercent: 100,
        generatedChapters: input.chapters,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        actualCostCents: input.actualCostCents,
        providerRequestId: input.providerRequestId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(chapterGenerationRuns.id, input.chapterGenerationRunId)),
    database
      .update(usageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(
        eq(usageReservations.chapterGenerationId, input.chapterGenerationRunId),
      ),
    database
      .insert(videoRenderChapters)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        renderId: input.renderId,
        chapters: input.chapters,
        source: "generated",
        chapterGenerationRunId: input.chapterGenerationRunId,
        updatedByUserId: input.userId,
      })
      .onConflictDoUpdate({
        target: videoRenderChapters.renderId,
        set: {
          chapters: input.chapters,
          source: "generated",
          chapterGenerationRunId: input.chapterGenerationRunId,
          version: sql`${videoRenderChapters.version} + 1`,
          updatedByUserId: input.userId,
          updatedAt: now,
        },
        // A conflicting row is only ever this tenant's: render ids are
        // unique, and the tenant key ties each render to one workspace.
        setWhere: eq(videoRenderChapters.workspaceId, input.workspaceId),
      }),
  ]);
}

export async function failChapterGeneration(input: {
  chapterGenerationRunId: string;
  category: string;
  message: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(chapterGenerationRuns)
      .set({
        status: "failed",
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(chapterGenerationRuns.id, input.chapterGenerationRunId)),
    getDatabase()
      .update(usageReservations)
      .set({ status: "released", actualCostCents: 0, updatedAt: now })
      .where(
        and(
          eq(
            usageReservations.chapterGenerationId,
            input.chapterGenerationRunId,
          ),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}

/**
 * Cancel a run that has not started executing, releasing its reservation.
 * Mirrors `cancelTitleGeneration`.
 */
export async function cancelChapterGeneration(input: {
  workspaceId: string;
  projectId: string;
  chapterGenerationRunId: string;
}): Promise<{ cancelled: boolean }> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select run.id
      from chapter_generation_runs run
      inner join usage_reservations reservation
        on reservation.workspace_id = run.workspace_id
        and reservation.project_id = run.project_id
        and reservation.operation_type = 'chapter_generation'
        and reservation.chapter_generation_id = run.id
      where run.workspace_id = ${input.workspaceId}
        and run.project_id = ${input.projectId}
        and run.id = ${input.chapterGenerationRunId}
        and run.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of run, reservation
    ),
    transitioned_run as (
      update chapter_generation_runs run
      set
        status = 'failed'::scene_analysis_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'cancelled',
        safe_error_message = 'Chapter generation was cancelled before it started.',
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
        and reservation.operation_type = 'chapter_generation'
        and reservation.chapter_generation_id = transitioned_run.id
        and reservation.status = 'pending'
      returning reservation.id
    )
    select transitioned_run.id
    from transitioned_run
    inner join transitioned_reservation on true
  `);
  return { cancelled: result.rows.length === 1 };
}

export type SaveVideoRenderChaptersResult =
  { saved: true; version: number } | { saved: false; reason: "stale" };

/**
 * Save the person's edits, but only over the version they loaded.
 *
 * Version 0 means "there were no chapters yet": the row is created only if it
 * still does not exist. Anything else updates only when the stored version is
 * still the one the editor started from, so a generation that finished while
 * they were typing is never silently overwritten.
 */
export async function saveVideoRenderChapters(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  chapters: VideoChapter[];
  includeInYouTubeDescription: boolean;
  expectedVersion: number;
  userId: string;
}): Promise<SaveVideoRenderChaptersResult> {
  const now = new Date();
  if (input.expectedVersion === 0) {
    const inserted = await getDatabase()
      .insert(videoRenderChapters)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        renderId: input.renderId,
        chapters: input.chapters,
        includeInYouTubeDescription: input.includeInYouTubeDescription,
        source: "edited",
        updatedByUserId: input.userId,
      })
      .onConflictDoNothing({ target: videoRenderChapters.renderId })
      .returning({ version: videoRenderChapters.version });
    const row = inserted[0];
    return row
      ? { saved: true, version: row.version }
      : { saved: false, reason: "stale" };
  }

  const updated = await getDatabase()
    .update(videoRenderChapters)
    .set({
      chapters: input.chapters,
      includeInYouTubeDescription: input.includeInYouTubeDescription,
      source: "edited",
      version: sql`${videoRenderChapters.version} + 1`,
      updatedByUserId: input.userId,
      updatedAt: now,
    })
    .where(
      and(
        eq(videoRenderChapters.workspaceId, input.workspaceId),
        eq(videoRenderChapters.projectId, input.projectId),
        eq(videoRenderChapters.renderId, input.renderId),
        eq(videoRenderChapters.version, input.expectedVersion),
      ),
    )
    .returning({ version: videoRenderChapters.version });
  const row = updated[0];
  return row
    ? { saved: true, version: row.version }
    : { saved: false, reason: "stale" };
}
