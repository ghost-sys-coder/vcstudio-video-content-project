import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { videoRenders } from "@/db/schema";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  findVideoRender,
  findVideoRenderByIdempotencyKey,
  findVideoRenderByRequestNonce,
  findVideoRenderReservation,
} from "@/db/repositories/video-render.repository";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";

type AspectRatio = typeof videoRenders.$inferInsert.aspectRatio;

function createUsageEventId(
  reservationId: string,
  eventType: "reserved" | "reconciled" | "released",
): string {
  const value = createHash("sha256")
    .update(`usage-event:${reservationId}:${eventType}`)
    .digest("hex")
    .slice(0, 32);
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-");
}

function readDatabaseErrorField(
  error: unknown,
  field: "code" | "constraint",
): string | null {
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const candidate = pending.shift();
    if (typeof candidate !== "object" || candidate === null) continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    const value = Reflect.get(candidate, field);
    if (typeof value === "string") return value;
    pending.push(
      Reflect.get(candidate, "cause"),
      Reflect.get(candidate, "sourceError"),
    );
  }
  return null;
}

function isUniqueConstraintError(error: unknown, constraint: string): boolean {
  return (
    readDatabaseErrorField(error, "code") === "23505" &&
    readDatabaseErrorField(error, "constraint") === constraint
  );
}

function assertNonnegativeInteger(value: number | null, field: string): void {
  if (value !== null && (!Number.isInteger(value) || value < 0))
    throw new Error(`INVALID_${field.toUpperCase()}`);
}

function renderMatchesRequest(
  render: typeof videoRenders.$inferSelect,
  input: { idempotencyKey: string; requestFingerprint: string },
): boolean {
  return (
    render.idempotencyKey === input.idempotencyKey &&
    render.requestFingerprint === input.requestFingerprint
  );
}

/**
 * Atomically inserts a video render, its pending cost reservation, and the
 * reserved usage event under a per-workspace advisory lock and budget guard.
 * Reuses the proven scene-generation money-safety machinery so a render can
 * never be created without a reservation, and can never exceed the project,
 * daily, or monthly budgets.
 */
export async function createVideoRenderReservation(input: {
  renderId: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  requestNonce: string;
  idempotencyKey: string;
  requestFingerprint: string;
  preset: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  framesPerSecond: number;
  includeCaptions: boolean;
  includeWatermark: boolean;
  sceneCount: number;
  captionCount: number;
  durationMilliseconds: number;
  totalFrames: number;
  timelineSnapshot: RenderTimelineSnapshot;
  estimatedCostCents: number;
  requestedByUserId: string;
  expiresAt: Date;
  budget: {
    workspaceDailyLimitCents: number;
    workspaceMonthlyLimitCents: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
  };
}) {
  assertNonnegativeInteger(input.estimatedCostCents, "estimated_cost_cents");
  if (input.sceneCount < 1) throw new Error("INVALID_VIDEO_RENDER_SCENE_COUNT");
  if (input.durationMilliseconds < 1 || input.totalFrames < 1)
    throw new Error("INVALID_VIDEO_RENDER_DURATION");

  const existingNonce = await findVideoRenderByRequestNonce({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    requestNonce: input.requestNonce,
  });
  if (existingNonce) {
    if (!renderMatchesRequest(existingNonce, input))
      throw new Error("VIDEO_RENDER_REQUEST_NONCE_CONFLICT");
    return { render: existingNonce, created: false as const };
  }

  const existingIdempotency = await findVideoRenderByIdempotencyKey({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existingIdempotency) {
    if (!renderMatchesRequest(existingIdempotency, input))
      throw new Error("VIDEO_RENDER_IDEMPOTENCY_CONFLICT");
    return { render: existingIdempotency, created: false as const };
  }

  const reservedEventMetadata = JSON.stringify({ renderId: input.renderId });
  const timelineSnapshotJson = JSON.stringify(input.timelineSnapshot);

  let budgetSnapshot: {
    render_id: string | null;
    maximum_budget_cents: number;
    project_cents: number;
    daily_cents: number;
    monthly_cents: number;
  } | null = null;
  try {
    const result = await getDatabase().execute<{
      render_id: string | null;
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
      inserted_render as (
        insert into video_renders (
          id, workspace_id, project_id, request_nonce, idempotency_key,
          request_fingerprint, preset, aspect_ratio, width, height,
          frames_per_second, include_captions, include_watermark, scene_count,
          caption_count, duration_milliseconds, total_frames, timeline_snapshot,
          estimated_cost_cents, requested_by_user_id
        )
        select
          ${input.renderId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          ${input.requestNonce}::uuid,
          ${input.idempotencyKey},
          ${input.requestFingerprint},
          ${input.preset},
          ${input.aspectRatio}::project_aspect_ratio,
          ${input.width},
          ${input.height},
          ${input.framesPerSecond},
          ${input.includeCaptions},
          ${input.includeWatermark},
          ${input.sceneCount},
          ${input.captionCount},
          ${input.durationMilliseconds},
          ${input.totalFrames},
          ${timelineSnapshotJson}::jsonb,
          ${input.estimatedCostCents},
          ${input.requestedByUserId}::uuid
        from eligible
        returning id
      ),
      inserted_reservation as (
        insert into usage_reservations (
          id, workspace_id, project_id, operation_type,
          video_render_id, reserved_cost_cents, expires_at
        )
        select
          ${input.reservationId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          'video_render'::usage_operation_type,
          inserted_render.id,
          ${input.estimatedCostCents},
          ${input.expiresAt}
        from inserted_render
        returning id
      ),
      inserted_event as (
        insert into usage_events (
          id, workspace_id, project_id, reservation_id, operation_type,
          event_type, estimated_cost_cents, safe_metadata
        )
        select
          ${createUsageEventId(input.reservationId, "reserved")}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          inserted_reservation.id,
          'video_render'::usage_operation_type,
          'reserved'::usage_event_type,
          ${input.estimatedCostCents},
          ${reservedEventMetadata}::jsonb
        from inserted_reservation
        returning id
      )
      select
        (select id from inserted_render) as render_id,
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
    budgetSnapshot = result.rows[0] ?? null;
  } catch (error) {
    if (
      isUniqueConstraintError(
        error,
        "video_renders_workspace_request_nonce_unique",
      ) ||
      isUniqueConstraintError(error, "video_renders_idempotency_unique")
    ) {
      const existing = await findVideoRenderByRequestNonce({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        requestNonce: input.requestNonce,
      });
      if (existing && renderMatchesRequest(existing, input))
        return { render: existing, created: false as const };
    }
    throw error;
  }

  const render = await findVideoRender({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    renderId: input.renderId,
  });
  if (!render) {
    if (!budgetSnapshot) throw new Error("PROJECT_NOT_FOUND");
    if (
      budgetSnapshot.project_cents + input.estimatedCostCents >
      budgetSnapshot.maximum_budget_cents
    )
      throw new BudgetExceededError("project");
    if (
      budgetSnapshot.daily_cents + input.estimatedCostCents >
      input.budget.workspaceDailyLimitCents
    )
      throw new BudgetExceededError("workspace_daily");
    throw new BudgetExceededError("workspace_monthly");
  }
  return { render, created: true as const };
}

export async function attachVideoRenderTriggerRun(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  triggerRunId: string;
}) {
  const [updated] = await getDatabase()
    .update(videoRenders)
    .set({
      triggerRunId: input.triggerRunId,
      status: sql`case when ${videoRenders.status} = 'pending' then 'queued'::render_status else ${videoRenders.status} end`,
      progressPercent: sql`case when ${videoRenders.status} = 'pending' then greatest(${videoRenders.progressPercent}, 5) else ${videoRenders.progressPercent} end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.id, input.renderId),
        isNull(videoRenders.triggerRunId),
        inArray(videoRenders.status, [
          "pending",
          "queued",
          "running",
          "succeeded",
        ]),
      ),
    )
    .returning();
  if (updated) return updated;
  const latest = await findVideoRender(input);
  if (!latest) throw new Error("VIDEO_RENDER_NOT_FOUND");
  return latest;
}

export async function claimVideoRenderRunning(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  attemptNumber: number;
  providerRequestId: string;
}) {
  const now = new Date();
  const [updated] = await getDatabase()
    .update(videoRenders)
    .set({
      status: "running",
      progressPercent: 15,
      attemptCount: input.attemptNumber,
      providerRequestId: input.providerRequestId,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.id, input.renderId),
        inArray(videoRenders.status, ["pending", "queued"]),
      ),
    )
    .returning();
  if (updated) return { render: updated, claimed: true as const };
  const current = await findVideoRender(input);
  if (!current) throw new Error("VIDEO_RENDER_NOT_FOUND");
  return { render: current, claimed: false as const };
}

export async function updateVideoRenderProgress(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  progressPercent: number;
}) {
  const clamped = Math.min(Math.max(Math.round(input.progressPercent), 0), 99);
  await getDatabase()
    .update(videoRenders)
    .set({ progressPercent: clamped, updatedAt: new Date() })
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.id, input.renderId),
        eq(videoRenders.status, "running"),
      ),
    );
}

export async function completeVideoRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  providerRequestId: string | null;
  actualCostCents: number;
  outputDurationMilliseconds: number | null;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    etag: string | null;
  };
}) {
  assertNonnegativeInteger(input.actualCostCents, "actual_cost_cents");
  assertNonnegativeInteger(
    input.outputDurationMilliseconds,
    "output_duration_milliseconds",
  );
  assertNonnegativeInteger(input.asset.sizeBytes, "asset_size_bytes");
  if (input.asset.sizeBytes === 0)
    throw new Error("INVALID_VIDEO_RENDER_ASSET");

  const reservation = await findVideoRenderReservation(input);
  if (!reservation) throw new Error("VIDEO_RENDER_RESERVATION_NOT_FOUND");
  const usageEventMetadata = JSON.stringify({
    renderId: input.renderId,
    providerRequestId: input.providerRequestId,
  });

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select render.id
      from video_renders render
      inner join usage_reservations reservation
        on reservation.workspace_id = render.workspace_id
        and reservation.project_id = render.project_id
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = render.id
      where render.workspace_id = ${input.workspaceId}
        and render.project_id = ${input.projectId}
        and render.id = ${input.renderId}
        and render.status in ('pending', 'queued', 'running')
        and reservation.status = 'pending'
      for update of render, reservation
    ),
    transitioned_render as (
      update video_renders render
      set
        status = 'succeeded'::render_status,
        progress_percent = 100,
        actual_cost_cents = ${input.actualCostCents},
        provider_request_id = coalesce(${input.providerRequestId}, render.provider_request_id),
        asset_object_key = ${input.asset.objectKey},
        asset_content_type = ${input.asset.contentType},
        asset_size_bytes = ${input.asset.sizeBytes},
        asset_etag = ${input.asset.etag},
        output_duration_milliseconds = ${input.outputDurationMilliseconds}::int,
        error_category = null,
        safe_error_message = null,
        completed_at = now(),
        updated_at = now()
      from eligible
      where render.id = eligible.id
      returning render.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = 'reconciled'::usage_reservation_status,
        actual_cost_cents = ${input.actualCostCents},
        updated_at = now()
      from transitioned_render
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = transitioned_render.id
        and reservation.status = 'pending'
      returning reservation.id, reservation.reserved_cost_cents
    ),
    inserted_event as (
      insert into usage_events (
        id, workspace_id, project_id, reservation_id, operation_type,
        event_type, estimated_cost_cents, actual_cost_cents, safe_metadata
      )
      select
        ${createUsageEventId(reservation.id, "reconciled")}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        transitioned_reservation.id,
        'video_render'::usage_operation_type,
        'reconciled'::usage_event_type,
        transitioned_reservation.reserved_cost_cents,
        ${input.actualCostCents},
        ${usageEventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_render.id
    from transitioned_render
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  if (result.rows.length === 1) {
    const completed = await findVideoRender(input);
    if (!completed || completed.status !== "succeeded")
      throw new Error("VIDEO_RENDER_COMPLETION_CONFLICT");
    return { render: completed, completed: true as const };
  }
  const current = await findVideoRender(input);
  if (
    current?.status === "succeeded" &&
    current.assetObjectKey === input.asset.objectKey
  )
    return { render: current, completed: false as const };
  throw new Error("VIDEO_RENDER_COMPLETION_CONFLICT");
}

export async function failVideoRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  category: string;
  safeErrorMessage: string;
  providerBilled?: boolean;
  actualCostCents?: number;
  providerRequestId?: string | null;
}) {
  const actualCostCents = input.actualCostCents ?? 0;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  const providerBilled = input.providerBilled === true || actualCostCents > 0;

  const render = await findVideoRender(input);
  if (!render) throw new Error("VIDEO_RENDER_NOT_FOUND");
  if (render.status === "succeeded")
    throw new Error("VIDEO_RENDER_ALREADY_SUCCEEDED");
  if (render.status === "failed") return { render, failed: false as const };
  const reservation = await findVideoRenderReservation(input);
  if (!reservation) throw new Error("VIDEO_RENDER_RESERVATION_NOT_FOUND");

  const reservationStatus = providerBilled ? "reconciled" : "released";
  const eventType = providerBilled ? "reconciled" : "released";
  const eventMetadata = JSON.stringify({
    renderId: input.renderId,
    category: input.category,
    providerBilled,
  });
  const eventId = createUsageEventId(reservation.id, eventType);

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select render.id
      from video_renders render
      inner join usage_reservations reservation
        on reservation.workspace_id = render.workspace_id
        and reservation.project_id = render.project_id
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = render.id
      where render.workspace_id = ${input.workspaceId}
        and render.project_id = ${input.projectId}
        and render.id = ${input.renderId}
        and render.status in ('pending', 'queued', 'running')
        and reservation.status = 'pending'
      for update of render, reservation
    ),
    transitioned_render as (
      update video_renders render
      set
        status = 'failed'::render_status,
        progress_percent = 100,
        actual_cost_cents = ${actualCostCents},
        provider_request_id = coalesce(${input.providerRequestId ?? null}, render.provider_request_id),
        error_category = ${input.category},
        safe_error_message = ${input.safeErrorMessage},
        completed_at = now(),
        updated_at = now()
      from eligible
      where render.id = eligible.id
      returning render.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = cast(${reservationStatus} as usage_reservation_status),
        actual_cost_cents = ${actualCostCents},
        updated_at = now()
      from transitioned_render
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = transitioned_render.id
        and reservation.status = 'pending'
      returning reservation.id, reservation.reserved_cost_cents
    ),
    inserted_event as (
      insert into usage_events (
        id, workspace_id, project_id, reservation_id, operation_type,
        event_type, estimated_cost_cents, actual_cost_cents, safe_metadata
      )
      select
        ${eventId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        transitioned_reservation.id,
        'video_render'::usage_operation_type,
        cast(${eventType} as usage_event_type),
        transitioned_reservation.reserved_cost_cents,
        ${actualCostCents},
        ${eventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_render.id
    from transitioned_render
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  if (result.rows.length === 1) {
    const failed = await findVideoRender(input);
    if (!failed || failed.status !== "failed")
      throw new Error("VIDEO_RENDER_FAILURE_CONFLICT");
    return { render: failed, failed: true as const };
  }
  const current = await findVideoRender(input);
  if (current?.status === "failed")
    return { render: current, failed: false as const };
  throw new Error("VIDEO_RENDER_FAILURE_CONFLICT");
}

export async function cancelVideoRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}): Promise<{ cancelled: boolean }> {
  const render = await findVideoRender(input);
  if (!render) throw new Error("VIDEO_RENDER_NOT_FOUND");
  if (render.status !== "pending" && render.status !== "queued")
    return { cancelled: false };
  const reservation = await findVideoRenderReservation(input);
  if (!reservation || reservation.status !== "pending")
    return { cancelled: false };

  const eventMetadata = JSON.stringify({
    renderId: input.renderId,
    category: "cancelled",
  });
  const eventId = createUsageEventId(reservation.id, "released");

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select render.id
      from video_renders render
      inner join usage_reservations reservation
        on reservation.workspace_id = render.workspace_id
        and reservation.project_id = render.project_id
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = render.id
      where render.workspace_id = ${input.workspaceId}
        and render.project_id = ${input.projectId}
        and render.id = ${input.renderId}
        and render.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of render, reservation
    ),
    transitioned_render as (
      update video_renders render
      set
        status = 'cancelled'::render_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'cancelled',
        safe_error_message = 'This render was cancelled before it started.',
        completed_at = now(),
        updated_at = now()
      from eligible
      where render.id = eligible.id
      returning render.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set status = 'released'::usage_reservation_status, actual_cost_cents = 0, updated_at = now()
      from transitioned_render
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'video_render'
        and reservation.video_render_id = transitioned_render.id
        and reservation.status = 'pending'
      returning reservation.id, reservation.reserved_cost_cents
    ),
    inserted_event as (
      insert into usage_events (
        id, workspace_id, project_id, reservation_id, operation_type,
        event_type, estimated_cost_cents, actual_cost_cents, safe_metadata
      )
      select
        ${eventId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        transitioned_reservation.id,
        'video_render'::usage_operation_type,
        'released'::usage_event_type,
        transitioned_reservation.reserved_cost_cents,
        0,
        ${eventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_render.id
    from transitioned_render
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  return { cancelled: result.rows.length === 1 };
}
