import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneAudioGenerations } from "@/db/schema";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  findSceneAudioGeneration,
  findSceneAudioGenerationByIdempotencyKey,
  findSceneAudioGenerationByRequestNonce,
  findSceneAudioReservation,
} from "@/db/repositories/scene-audio.repository";

type AudioFormat = typeof sceneAudioGenerations.$inferInsert.format;

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

function generationMatchesRequest(
  generation: typeof sceneAudioGenerations.$inferSelect,
  input: {
    sceneVersionId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    generationVersion: number;
  },
): boolean {
  return (
    generation.sceneVersionId === input.sceneVersionId &&
    generation.idempotencyKey === input.idempotencyKey &&
    generation.requestFingerprint === input.requestFingerprint &&
    generation.generationVersion === input.generationVersion
  );
}

export async function createSceneAudioGenerationReservation(input: {
  generationId: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  voicePresetId: string;
  generationVersion: number;
  requestNonce: string;
  idempotencyKey: string;
  requestFingerprint: string;
  provider: string;
  model: string;
  voice: string;
  format: AudioFormat;
  speedScaledPercent: number;
  instructions: string;
  sampleRate: number | null;
  inputText: string;
  inputCharacterCount: number;
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
  if (!Number.isInteger(input.generationVersion) || input.generationVersion < 1)
    throw new Error("INVALID_SCENE_AUDIO_GENERATION_VERSION");
  assertNonnegativeInteger(input.estimatedCostCents, "estimated_cost_cents");
  if (
    !Number.isInteger(input.inputCharacterCount) ||
    input.inputCharacterCount < 1
  )
    throw new Error("INVALID_SCENE_AUDIO_INPUT_CHARACTER_COUNT");

  const existingNonce = await findSceneAudioGenerationByRequestNonce({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    requestNonce: input.requestNonce,
  });
  if (existingNonce) {
    if (!generationMatchesRequest(existingNonce, input))
      throw new Error("SCENE_AUDIO_REQUEST_NONCE_CONFLICT");
    return { generation: existingNonce, created: false as const };
  }

  const existingIdempotency = await findSceneAudioGenerationByIdempotencyKey({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existingIdempotency) {
    if (!generationMatchesRequest(existingIdempotency, input))
      throw new Error("SCENE_AUDIO_IDEMPOTENCY_CONFLICT");
    return { generation: existingIdempotency, created: false as const };
  }

  const reservedEventMetadata = JSON.stringify({
    generationId: input.generationId,
    generationVersion: input.generationVersion,
  });

  let budgetSnapshot: {
    generation_id: string | null;
    maximum_budget_cents: number;
    project_cents: number;
    daily_cents: number;
    monthly_cents: number;
  } | null = null;
  try {
    const result = await getDatabase().execute<{
      generation_id: string | null;
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
        insert into scene_audio_generations (
          id, workspace_id, project_id, scene_id, scene_version_id,
          voice_preset_id, generation_version, request_nonce, idempotency_key,
          request_fingerprint, provider, model, voice, format,
          speed_scaled_percent, instructions, sample_rate, input_text,
          input_character_count, estimated_cost_cents, requested_by_user_id
        )
        select
          ${input.generationId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          ${input.sceneId}::uuid,
          ${input.sceneVersionId}::uuid,
          ${input.voicePresetId}::uuid,
          ${input.generationVersion},
          ${input.requestNonce}::uuid,
          ${input.idempotencyKey},
          ${input.requestFingerprint},
          ${input.provider},
          ${input.model},
          ${input.voice},
          ${input.format}::audio_output_format,
          ${input.speedScaledPercent},
          ${input.instructions},
          ${input.sampleRate}::int,
          ${input.inputText},
          ${input.inputCharacterCount},
          ${input.estimatedCostCents},
          ${input.requestedByUserId}::uuid
        from eligible
        returning id
      ),
      inserted_reservation as (
        insert into usage_reservations (
          id, workspace_id, project_id, operation_type,
          audio_generation_id, reserved_cost_cents, expires_at
        )
        select
          ${input.reservationId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          'scene_audio_generation'::usage_operation_type,
          inserted_generation.id,
          ${input.estimatedCostCents},
          ${input.expiresAt}
        from inserted_generation
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
          'scene_audio_generation'::usage_operation_type,
          'reserved'::usage_event_type,
          ${input.estimatedCostCents},
          ${reservedEventMetadata}::jsonb
        from inserted_reservation
        returning id
      )
      select
        (select id from inserted_generation) as generation_id,
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
        "scene_audio_generations_workspace_request_nonce_unique",
      ) ||
      isUniqueConstraintError(
        error,
        "scene_audio_generations_idempotency_unique",
      )
    ) {
      const existing = await findSceneAudioGenerationByRequestNonce({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        requestNonce: input.requestNonce,
      });
      if (existing && generationMatchesRequest(existing, input))
        return { generation: existing, created: false as const };
    }
    if (
      isUniqueConstraintError(error, "scene_audio_generations_version_unique")
    )
      throw new Error("SCENE_AUDIO_GENERATION_VERSION_CONFLICT");
    throw error;
  }

  const generation = await findSceneAudioGeneration({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationId: input.generationId,
  });
  if (!generation) {
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
  return { generation, created: true as const };
}

export async function attachSceneAudioTriggerRun(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  triggerRunId: string;
}) {
  const [updated] = await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      triggerRunId: input.triggerRunId,
      status: sql`case when ${sceneAudioGenerations.status} = 'pending' then 'queued'::audio_generation_status else ${sceneAudioGenerations.status} end`,
      progressPercent: sql`case when ${sceneAudioGenerations.status} = 'pending' then greatest(${sceneAudioGenerations.progressPercent}, 5) else ${sceneAudioGenerations.progressPercent} end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        isNull(sceneAudioGenerations.triggerRunId),
        inArray(sceneAudioGenerations.status, [
          "pending",
          "queued",
          "running",
          "succeeded",
        ]),
      ),
    )
    .returning();
  if (updated) return updated;
  const latest = await findSceneAudioGeneration(input);
  if (!latest) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  return latest;
}

export async function claimSceneAudioRunning(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber: number;
  providerRequestId: string;
}) {
  const now = new Date();
  const [updated] = await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      status: "running",
      progressPercent: 25,
      attemptCount: input.attemptNumber,
      providerRequestId: input.providerRequestId,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        inArray(sceneAudioGenerations.status, ["pending", "queued"]),
      ),
    )
    .returning();
  if (updated) return { generation: updated, claimed: true as const };
  const current = await findSceneAudioGeneration(input);
  if (!current) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  return { generation: current, claimed: false as const };
}

export async function completeSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  providerRequestId: string | null;
  actualCostCents: number;
  durationMilliseconds: number | null;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    etag: string | null;
  };
}) {
  assertNonnegativeInteger(input.actualCostCents, "actual_cost_cents");
  assertNonnegativeInteger(input.durationMilliseconds, "duration_milliseconds");
  assertNonnegativeInteger(input.asset.sizeBytes, "asset_size_bytes");
  if (input.asset.sizeBytes === 0) throw new Error("INVALID_SCENE_AUDIO_ASSET");

  const reservation = await findSceneAudioReservation(input);
  if (!reservation) throw new Error("SCENE_AUDIO_RESERVATION_NOT_FOUND");
  const usageEventMetadata = JSON.stringify({
    generationId: input.generationId,
    providerRequestId: input.providerRequestId,
  });

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select generation.id
      from scene_audio_generations generation
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.generationId}
        and generation.status in ('pending', 'queued', 'running')
        and reservation.status = 'pending'
      for update of generation, reservation
    ),
    transitioned_generation as (
      update scene_audio_generations generation
      set
        status = 'succeeded'::audio_generation_status,
        progress_percent = 100,
        actual_cost_cents = ${input.actualCostCents},
        provider_request_id = coalesce(${input.providerRequestId}, generation.provider_request_id),
        asset_object_key = ${input.asset.objectKey},
        asset_content_type = ${input.asset.contentType},
        asset_size_bytes = ${input.asset.sizeBytes},
        asset_etag = ${input.asset.etag},
        duration_milliseconds = ${input.durationMilliseconds}::int,
        error_category = null,
        safe_error_message = null,
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
      returning generation.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = 'reconciled'::usage_reservation_status,
        actual_cost_cents = ${input.actualCostCents},
        updated_at = now()
      from transitioned_generation
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = transitioned_generation.id
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
        'scene_audio_generation'::usage_operation_type,
        'reconciled'::usage_event_type,
        transitioned_reservation.reserved_cost_cents,
        ${input.actualCostCents},
        ${usageEventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_generation.id
    from transitioned_generation
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  if (result.rows.length === 1) {
    const completed = await findSceneAudioGeneration(input);
    if (!completed || completed.status !== "succeeded")
      throw new Error("SCENE_AUDIO_COMPLETION_CONFLICT");
    return { generation: completed, completed: true as const };
  }
  const current = await findSceneAudioGeneration(input);
  if (
    current?.status === "succeeded" &&
    current.assetObjectKey === input.asset.objectKey
  )
    return { generation: current, completed: false as const };
  throw new Error("SCENE_AUDIO_COMPLETION_CONFLICT");
}

export async function failSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  category: string;
  safeErrorMessage: string;
  providerBilled?: boolean;
  actualCostCents?: number;
  providerRequestId?: string | null;
}) {
  const actualCostCents = input.actualCostCents ?? 0;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  const providerBilled = input.providerBilled === true || actualCostCents > 0;

  const generation = await findSceneAudioGeneration(input);
  if (!generation) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded")
    throw new Error("SCENE_AUDIO_GENERATION_ALREADY_SUCCEEDED");
  if (generation.status === "failed")
    return { generation, failed: false as const };
  const reservation = await findSceneAudioReservation(input);
  if (!reservation) throw new Error("SCENE_AUDIO_RESERVATION_NOT_FOUND");

  const reservationStatus = providerBilled ? "reconciled" : "released";
  const eventType = providerBilled ? "reconciled" : "released";
  const eventMetadata = JSON.stringify({
    generationId: input.generationId,
    category: input.category,
    providerBilled,
  });
  const eventId = createUsageEventId(reservation.id, eventType);

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select generation.id
      from scene_audio_generations generation
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.generationId}
        and generation.status in ('pending', 'queued', 'running')
        and reservation.status = 'pending'
      for update of generation, reservation
    ),
    transitioned_generation as (
      update scene_audio_generations generation
      set
        status = 'failed'::audio_generation_status,
        progress_percent = 100,
        actual_cost_cents = ${actualCostCents},
        provider_request_id = coalesce(${input.providerRequestId ?? null}, generation.provider_request_id),
        error_category = ${input.category},
        safe_error_message = ${input.safeErrorMessage},
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
      returning generation.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = cast(${reservationStatus} as usage_reservation_status),
        actual_cost_cents = ${actualCostCents},
        updated_at = now()
      from transitioned_generation
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = transitioned_generation.id
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
        'scene_audio_generation'::usage_operation_type,
        cast(${eventType} as usage_event_type),
        transitioned_reservation.reserved_cost_cents,
        ${actualCostCents},
        ${eventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_generation.id
    from transitioned_generation
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  if (result.rows.length === 1) {
    const failed = await findSceneAudioGeneration(input);
    if (!failed || failed.status !== "failed")
      throw new Error("SCENE_AUDIO_FAILURE_CONFLICT");
    return { generation: failed, failed: true as const };
  }
  const current = await findSceneAudioGeneration(input);
  if (current?.status === "failed")
    return { generation: current, failed: false as const };
  throw new Error("SCENE_AUDIO_FAILURE_CONFLICT");
}

export async function cancelSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}): Promise<{ cancelled: boolean }> {
  const generation = await findSceneAudioGeneration(input);
  if (!generation) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  if (generation.status !== "pending" && generation.status !== "queued")
    return { cancelled: false };
  const reservation = await findSceneAudioReservation(input);
  if (!reservation || reservation.status !== "pending")
    return { cancelled: false };

  const eventMetadata = JSON.stringify({
    generationId: input.generationId,
    category: "bulk_cancelled",
  });
  const eventId = createUsageEventId(reservation.id, "released");

  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select generation.id
      from scene_audio_generations generation
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.generationId}
        and generation.status in ('pending', 'queued')
        and reservation.status = 'pending'
      for update of generation, reservation
    ),
    transitioned_generation as (
      update scene_audio_generations generation
      set
        status = 'cancelled'::audio_generation_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'bulk_cancelled',
        safe_error_message = 'This narration was cancelled before it started.',
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
      returning generation.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set status = 'released'::usage_reservation_status, actual_cost_cents = 0, updated_at = now()
      from transitioned_generation
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'scene_audio_generation'
        and reservation.audio_generation_id = transitioned_generation.id
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
        'scene_audio_generation'::usage_operation_type,
        'released'::usage_event_type,
        transitioned_reservation.reserved_cost_cents,
        0,
        ${eventMetadata}::jsonb
      from transitioned_reservation
      returning id
    )
    select transitioned_generation.id
    from transitioned_generation
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  return { cancelled: result.rows.length === 1 };
}

export async function approveSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  userId: string;
}) {
  const generation = await findSceneAudioGeneration(input);
  if (!generation) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  if (generation.status !== "succeeded")
    throw new Error("SCENE_AUDIO_GENERATION_NOT_SUCCESSFUL");
  if (generation.reviewStatus === "approved") return generation;

  const now = new Date();
  const [, approvedRows] = await getDatabase().batch([
    getDatabase()
      .update(sceneAudioGenerations)
      .set({
        reviewStatus: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sceneAudioGenerations.workspaceId, input.workspaceId),
          eq(sceneAudioGenerations.projectId, input.projectId),
          eq(sceneAudioGenerations.sceneVersionId, generation.sceneVersionId),
          eq(sceneAudioGenerations.reviewStatus, "approved"),
          ne(sceneAudioGenerations.id, input.generationId),
        ),
      ),
    getDatabase()
      .update(sceneAudioGenerations)
      .set({
        reviewStatus: "approved",
        reviewedByUserId: input.userId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(sceneAudioGenerations.workspaceId, input.workspaceId),
          eq(sceneAudioGenerations.projectId, input.projectId),
          eq(sceneAudioGenerations.id, input.generationId),
          eq(sceneAudioGenerations.sceneVersionId, generation.sceneVersionId),
          eq(sceneAudioGenerations.status, "succeeded"),
        ),
      )
      .returning(),
  ]);
  const approved = approvedRows[0];
  if (!approved) throw new Error("SCENE_AUDIO_APPROVAL_CONFLICT");
  return approved;
}

export async function rejectSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  userId: string;
}) {
  const generation = await findSceneAudioGeneration(input);
  if (!generation) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
  if (generation.status !== "succeeded")
    throw new Error("SCENE_AUDIO_GENERATION_NOT_SUCCESSFUL");
  if (generation.reviewStatus === "rejected") return generation;
  const [rejected] = await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      reviewStatus: "rejected",
      reviewedByUserId: input.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        eq(sceneAudioGenerations.status, "succeeded"),
      ),
    )
    .returning();
  if (!rejected) throw new Error("SCENE_AUDIO_REJECTION_CONFLICT");
  return rejected;
}
