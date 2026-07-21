import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  thumbnailGenerations,
  usageReservations,
  type ContentPlatform,
  type ThumbnailTextMode,
} from "@/db/schema";
import { BudgetExceededError } from "@/lib/domain/errors";
import type {
  SceneImageOutputFormat,
  SceneImageQuality,
} from "@/lib/schemas/scene-image";

/**
 * Atomically reserve budget and create a thumbnail generation, mirroring
 * `createTitleGenerationReservation`: one advisory-locked SQL statement enforces
 * the project plus workspace daily/monthly budgets and inserts the generation
 * and its `usage_reservations` row (`operation_type = 'thumbnail_generation'`)
 * only when the workspace can actually afford the image.
 */
export async function createThumbnailGenerationReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  platform: ContentPlatform;
  textMode: ThumbnailTextMode;
  headlineText: string | null;
  scriptVersionId: string | null;
  promptTemplateVersionId: string;
  promptTemplateVersion: string;
  finalPrompt: string;
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  quality: SceneImageQuality;
  size: string;
  outputFormat: SceneImageOutputFormat;
  outputCompression: number;
  background: string;
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
    throw new Error("INVALID_THUMBNAIL_GENERATION_BUDGET");
  if (
    !Number.isInteger(input.outputCompression) ||
    input.outputCompression < 1 ||
    input.outputCompression > 100
  )
    throw new Error("INVALID_THUMBNAIL_GENERATION_COMPRESSION");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_THUMBNAIL_GENERATION_BUDGET_WINDOW");
  if (input.textMode === "baked" && (input.headlineText ?? "").trim() === "")
    throw new Error("THUMBNAIL_HEADLINE_REQUIRED");
  if (input.textMode === "clean" && input.headlineText !== null)
    throw new Error("THUMBNAIL_HEADLINE_NOT_ALLOWED");

  const result = await getDatabase().execute<{
    thumbnail_generation_id: string | null;
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
    inserted_generation as (
      insert into thumbnail_generations (
        id, workspace_id, project_id, requested_by_user_id, platform,
        text_mode, headline_text, script_version_id, prompt_template_version_id,
        prompt_template_version, final_prompt, idempotency_key,
        request_fingerprint, model, quality, size, output_format,
        output_compression, background, estimated_cost_cents
      )
      select
        ${input.id}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        ${input.userId}::uuid,
        ${input.platform}::content_platform,
        ${input.textMode}::thumbnail_text_mode,
        ${input.headlineText},
        ${input.scriptVersionId}::uuid,
        ${input.promptTemplateVersionId}::uuid,
        ${input.promptTemplateVersion},
        ${input.finalPrompt},
        ${input.idempotencyKey},
        ${input.requestFingerprint},
        ${input.model},
        ${input.quality}::image_quality,
        ${input.size},
        ${input.outputFormat}::image_output_format,
        ${input.outputCompression},
        ${input.background},
        ${input.estimatedCostCents}
      from eligible
      returning id
    ),
    inserted_reservation as (
      insert into usage_reservations (
        id, workspace_id, project_id, operation_type,
        thumbnail_generation_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'thumbnail_generation'::usage_operation_type,
        inserted_generation.id,
        ${input.estimatedCostCents},
        ${input.expiresAt}
      from inserted_generation
      returning id
    )
    select
      (select id from inserted_generation) as thumbnail_generation_id,
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
  if (row.thumbnail_generation_id && row.reservation_id) return;
  if (row.project_cents + input.estimatedCostCents > row.maximum_budget_cents)
    throw new BudgetExceededError("project");
  if (
    row.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new BudgetExceededError("workspace_daily");
  throw new BudgetExceededError("workspace_monthly");
}

export async function attachThumbnailGenerationTriggerRun(input: {
  thumbnailGenerationId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(thumbnailGenerations)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(thumbnailGenerations.id, input.thumbnailGenerationId));
}

export async function markThumbnailGenerationRunning(input: {
  thumbnailGenerationId: string;
  attemptCount: number;
}) {
  const now = new Date();
  await getDatabase()
    .update(thumbnailGenerations)
    .set({
      status: "running",
      progressPercent: 25,
      attemptCount: input.attemptCount,
      startedAt: now,
      updatedAt: now,
    })
    .where(eq(thumbnailGenerations.id, input.thumbnailGenerationId));
}

export async function syncThumbnailGenerationRunning(input: {
  thumbnailGenerationId: string;
  workspaceId: string;
  projectId: string;
}) {
  await getDatabase()
    .update(thumbnailGenerations)
    .set({ status: "running", progressPercent: 25, updatedAt: new Date() })
    .where(
      and(
        eq(thumbnailGenerations.id, input.thumbnailGenerationId),
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
        eq(thumbnailGenerations.status, "queued"),
      ),
    );
}

/**
 * Record the stored image and reconcile the reservation with actual spend in one
 * batch, so the asset pointer and the ledger land together.
 */
export async function completeThumbnailGeneration(input: {
  thumbnailGenerationId: string;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
    etag: string;
  };
  actualCostCents: number;
  providerRequestId: string | null;
}) {
  const now = new Date();
  const database = getDatabase();
  await database.batch([
    database
      .update(thumbnailGenerations)
      .set({
        status: "succeeded",
        progressPercent: 100,
        assetObjectKey: input.asset.objectKey,
        assetContentType: input.asset.contentType,
        assetSizeBytes: input.asset.sizeBytes,
        assetWidth: input.asset.width,
        assetHeight: input.asset.height,
        assetEtag: input.asset.etag,
        actualCostCents: input.actualCostCents,
        providerRequestId: input.providerRequestId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(thumbnailGenerations.id, input.thumbnailGenerationId)),
    database
      .update(usageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(
        eq(
          usageReservations.thumbnailGenerationId,
          input.thumbnailGenerationId,
        ),
      ),
  ]);
}

/**
 * Fail a generation and settle its reservation. `chargedCostCents` is non-zero
 * only when the provider may have accepted (and therefore billed) the request
 * despite the failure — releasing to zero there would silently under-record
 * real spend. Otherwise the reservation is released in full.
 */
export async function failThumbnailGeneration(input: {
  thumbnailGenerationId: string;
  category: string;
  message: string;
  chargedCostCents?: number;
}) {
  const now = new Date();
  const database = getDatabase();
  const charged = input.chargedCostCents ?? 0;
  if (!Number.isInteger(charged) || charged < 0)
    throw new Error("INVALID_THUMBNAIL_FAILURE_CHARGE");
  await database.batch([
    database
      .update(thumbnailGenerations)
      .set({
        status: "failed",
        actualCostCents: charged,
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(thumbnailGenerations.id, input.thumbnailGenerationId)),
    database
      .update(usageReservations)
      .set({
        status: charged > 0 ? "reconciled" : "released",
        actualCostCents: charged,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            usageReservations.thumbnailGenerationId,
            input.thumbnailGenerationId,
          ),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}

/**
 * Cancel a thumbnail generation that has not started executing yet, releasing
 * its budget reservation. Mirrors `cancelTitleGeneration`.
 */
export async function cancelThumbnailGeneration(input: {
  workspaceId: string;
  projectId: string;
  thumbnailGenerationId: string;
}): Promise<{ cancelled: boolean }> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select generation.id
      from thumbnail_generations generation
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'thumbnail_generation'
        and reservation.thumbnail_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.thumbnailGenerationId}
        and generation.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of generation, reservation
    ),
    transitioned_generation as (
      update thumbnail_generations generation
      set
        status = 'cancelled'::image_generation_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'cancelled',
        safe_error_message = 'Thumbnail generation was cancelled before it started.',
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
      returning generation.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = 'released'::usage_reservation_status,
        actual_cost_cents = 0,
        updated_at = now()
      from transitioned_generation
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'thumbnail_generation'
        and reservation.thumbnail_generation_id = transitioned_generation.id
        and reservation.status = 'pending'
      returning reservation.id
    )
    select transitioned_generation.id
    from transitioned_generation
    inner join transitioned_reservation on true
  `);
  return { cancelled: result.rows.length === 1 };
}

/**
 * Hide a dead generation from the gallery. Deliberately a soft flag, never a
 * delete: `usage_reservations.thumbnail_generation_id` cascades, so deleting a
 * charged failure would erase real spend from the usage ledger.
 *
 * Restricted to terminal generations that produced no asset, so a successful
 * thumbnail can never be hidden by this path.
 */
export async function dismissThumbnailGeneration(input: {
  workspaceId: string;
  projectId: string;
  thumbnailGenerationId: string;
}): Promise<{ dismissed: boolean }> {
  const result = await getDatabase()
    .update(thumbnailGenerations)
    .set({ dismissedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(thumbnailGenerations.id, input.thumbnailGenerationId),
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
        inArray(thumbnailGenerations.status, ["failed", "cancelled"]),
        isNull(thumbnailGenerations.assetObjectKey),
        isNull(thumbnailGenerations.dismissedAt),
      ),
    )
    .returning({ id: thumbnailGenerations.id });
  return { dismissed: result.length === 1 };
}

/**
 * Toggle a thumbnail's favorite flag. Workspace/project scoped so a browser
 * cannot flip favorites across tenants.
 */
export async function setThumbnailFavorite(input: {
  workspaceId: string;
  projectId: string;
  thumbnailGenerationId: string;
  isFavorite: boolean;
}): Promise<{ updated: boolean }> {
  const result = await getDatabase()
    .update(thumbnailGenerations)
    .set({ isFavorite: input.isFavorite, updatedAt: new Date() })
    .where(
      and(
        eq(thumbnailGenerations.id, input.thumbnailGenerationId),
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
      ),
    )
    .returning({ id: thumbnailGenerations.id });
  return { updated: result.length === 1 };
}
