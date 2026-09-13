import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  SCENE_MOTION_PROMPT_TEMPLATE_SOURCE,
  SCENE_MOTION_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_MOTION_PROMPT_VERSION,
} from "@studio/prompts";
import { getDatabase } from "@/db/drizzle";
import { promptTemplateVersions, sceneVideoGenerations } from "@/db/schema";
import {
  findSceneClipByIdempotencyKey,
  findSceneClipByRequestNonce,
  findSceneClipGeneration,
  findSceneClipReservation,
} from "@/db/repositories/scene-videos.repository";

/**
 * Writes for scene clips.
 *
 * **Where the money is.** A clip is a paid generation, so the same discipline
 * the image pipeline uses applies here: nothing is requested from a provider
 * until a reservation exists, the reservation is created in the same statement
 * as the row it pays for, and it is settled exactly once, either reconciled
 * against what was actually spent or released back untouched.
 *
 * **Why the provider attempt lives on this row.** The image pipeline records
 * attempts in `provider_requests`, but that table is tenant-keyed to image
 * generations and cannot hold a clip. Rather than widen it, a clip carries its
 * own provider, model, job handle, attempt count and costs, which is everything
 * `AGENTS.md` asks a provider operation to record.
 */

/**
 * Makes sure the motion prompt this build carries exists as a row.
 *
 * Self-ensuring rather than seeded, matching the image and outpaint templates,
 * because the schema is applied by hand here and a seed step would be the one
 * thing everybody forgets. `on conflict do nothing` makes it safe to call on
 * every request; the row is immutable once written.
 */
export async function ensureSceneMotionPromptTemplate(): Promise<void> {
  await getDatabase()
    .insert(promptTemplateVersions)
    .values({
      templateKey: "scene-motion",
      version: SCENE_MOTION_PROMPT_VERSION,
      sourceHash: SCENE_MOTION_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: SCENE_MOTION_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();
}

/** Deterministic, so the same settlement can never write two events. */
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

function assertNonnegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`INVALID_SCENE_CLIP_${label.toUpperCase()}`);
}

export class SceneClipBudgetExceededError extends Error {
  readonly scope: "project" | "workspace_daily" | "workspace_monthly";

  constructor(scope: "project" | "workspace_daily" | "workspace_monthly") {
    super(`Scene clip budget exceeded: ${scope}`);
    this.name = "SceneClipBudgetExceededError";
    this.scope = scope;
  }
}

type CreateClipReservationInput = {
  generationId: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  outputVariantId: string | null;
  sourceImageGenerationId: string | null;
  mode: "image_to_video" | "text_to_video";
  provider: string;
  model: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  resolutionHeight: number;
  durationSeconds: number;
  loopCount: number;
  trimmed: boolean;
  motionDescription: string;
  promptTemplateVersionId: string;
  promptTemplateVersion: string;
  finalPrompt: string;
  generationVersion: number;
  requestNonce: string;
  idempotencyKey: string;
  requestFingerprint: string;
  estimatedCostCents: number;
  requestedByUserId: string;
  expiresAt: Date;
  budget: {
    workspaceDailyLimitCents: number;
    workspaceMonthlyLimitCents: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
  };
};

/**
 * Creates the clip row and the money that pays for it, or neither.
 *
 * One statement, because two would allow a generation with no reservation
 * behind it, which is a request nobody agreed to fund. The advisory lock makes
 * the budget arithmetic serialisable per workspace: without it two clips
 * started together each see the balance before the other and both fit under a
 * limit that only had room for one.
 */
export async function createSceneClipGenerationReservation(
  input: CreateClipReservationInput,
) {
  assertNonnegativeInteger(input.estimatedCostCents, "estimated_cost_cents");
  if (input.durationSeconds <= 0)
    throw new Error("INVALID_SCENE_CLIP_DURATION");
  if (input.loopCount <= 0) throw new Error("INVALID_SCENE_CLIP_LOOP_COUNT");
  if (input.resolutionHeight <= 0)
    throw new Error("INVALID_SCENE_CLIP_RESOLUTION");
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_SCENE_CLIP_BUDGET_WINDOW");
  if (
    (input.mode === "image_to_video") !==
    (input.sourceImageGenerationId !== null)
  )
    throw new Error("INVALID_SCENE_CLIP_SOURCE_IMAGE");

  // Both are checked before spending rather than relying on the unique indexes,
  // so an honest repeat (a double click, a retried dispatch) returns the work
  // already in flight instead of surfacing a constraint violation.
  const existingNonce = await findSceneClipByRequestNonce(input);
  if (existingNonce)
    return { generation: existingNonce, created: false as const };
  const existingKey = await findSceneClipByIdempotencyKey(input);
  if (existingKey) return { generation: existingKey, created: false as const };

  const reservedEventMetadata = JSON.stringify({
    generationId: input.generationId,
    generationVersion: input.generationVersion,
    durationSeconds: input.durationSeconds,
  });

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
      insert into scene_video_generations (
        id, workspace_id, project_id, scene_id, scene_version_id,
        output_variant_id, source_image_generation_id, mode, provider, model,
        aspect_ratio, resolution_height, duration_seconds, loop_count, trimmed,
        motion_description, prompt_template_version_id, prompt_template_version,
        final_prompt, generation_version, request_nonce, idempotency_key,
        request_fingerprint, estimated_cost_cents, requested_by_user_id
      )
      select
        ${input.generationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        ${input.sceneId}::uuid,
        ${input.sceneVersionId}::uuid,
        ${input.outputVariantId}::uuid,
        ${input.sourceImageGenerationId}::uuid,
        ${input.mode}::scene_clip_mode,
        ${input.provider},
        ${input.model},
        ${input.aspectRatio},
        ${input.resolutionHeight},
        ${input.durationSeconds},
        ${input.loopCount},
        ${input.trimmed},
        ${input.motionDescription},
        ${input.promptTemplateVersionId}::uuid,
        ${input.promptTemplateVersion},
        ${input.finalPrompt},
        ${input.generationVersion},
        ${input.requestNonce}::uuid,
        ${input.idempotencyKey},
        ${input.requestFingerprint},
        ${input.estimatedCostCents},
        ${input.requestedByUserId}::uuid
      from eligible
      returning id
    ),
    inserted_reservation as (
      insert into usage_reservations (
        id, workspace_id, project_id, operation_type,
        clip_generation_id, reserved_cost_cents, expires_at
      )
      select
        ${input.reservationId}::uuid,
        ${input.workspaceId}::uuid,
        ${input.projectId}::uuid,
        'scene_video_generation'::usage_operation_type,
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
        'scene_video_generation'::usage_operation_type,
        'reserved'::usage_event_type,
        ${input.estimatedCostCents},
        ${reservedEventMetadata}::jsonb
      from inserted_reservation
      returning id
    )
    select
      (select id from inserted_generation) as generation_id,
      (select p.maximum_budget_cents from projects p
        where p.workspace_id = ${input.workspaceId} and p.id = ${input.projectId}) as maximum_budget_cents,
      c.project_cents, c.daily_cents, c.monthly_cents
    from committed c
  `);

  const snapshot = result.rows[0];
  if (snapshot?.generation_id) {
    const generation = await findSceneClipGeneration(input);
    if (!generation) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
    return { generation, created: true as const };
  }

  // Nothing was written, so say which limit refused it rather than a generic
  // failure the person cannot act on.
  if (!snapshot) throw new Error("SCENE_CLIP_BUDGET_SNAPSHOT_MISSING");
  if (
    snapshot.project_cents + input.estimatedCostCents >
    snapshot.maximum_budget_cents
  )
    throw new SceneClipBudgetExceededError("project");
  if (
    snapshot.daily_cents + input.estimatedCostCents >
    input.budget.workspaceDailyLimitCents
  )
    throw new SceneClipBudgetExceededError("workspace_daily");
  throw new SceneClipBudgetExceededError("workspace_monthly");
}

/** Points the generation at the run that will carry it out. */
export async function attachSceneClipTriggerRun(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  triggerRunId: string;
}) {
  const [updated] = await getDatabase()
    .update(sceneVideoGenerations)
    .set({
      triggerRunId: input.triggerRunId,
      status: sql`case when ${sceneVideoGenerations.status} = 'pending' then 'queued'::scene_clip_status else ${sceneVideoGenerations.status} end`,
      progressPercent: sql`greatest(${sceneVideoGenerations.progressPercent}, 5)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.id, input.generationId),
        inArray(sceneVideoGenerations.status, ["pending", "queued"]),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Claims the generation for this attempt.
 *
 * Returns null when another run already has it, which is how a duplicate
 * dispatch declines to start a second paid job rather than racing the first.
 */
export async function claimSceneClipRunning(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [claimed] = await getDatabase()
    .update(sceneVideoGenerations)
    .set({
      status: "running",
      attemptCount: sql`${sceneVideoGenerations.attemptCount} + 1`,
      startedAt: sql`coalesce(${sceneVideoGenerations.startedAt}, now())`,
      progressPercent: sql`greatest(${sceneVideoGenerations.progressPercent}, 10)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.id, input.generationId),
        inArray(sceneVideoGenerations.status, ["pending", "queued"]),
      ),
    )
    .returning();
  return claimed ?? null;
}

/** Records the vendor's job handle, so polling survives a lost worker. */
export async function recordSceneClipProviderJob(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  providerJobId: string;
  providerRequestId: string | null;
}) {
  const [updated] = await getDatabase()
    .update(sceneVideoGenerations)
    .set({
      providerJobId: input.providerJobId,
      providerRequestId: input.providerRequestId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.id, input.generationId),
        eq(sceneVideoGenerations.status, "running"),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function updateSceneClipProgress(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  progressPercent: number;
}) {
  const bounded = Math.max(0, Math.min(99, Math.round(input.progressPercent)));
  await getDatabase()
    .update(sceneVideoGenerations)
    .set({
      // Never moves backwards: a provider that reports 40 then 20 would
      // otherwise make the bar jump about for no reason the viewer can see.
      progressPercent: sql`greatest(${sceneVideoGenerations.progressPercent}, ${bounded})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.id, input.generationId),
        eq(sceneVideoGenerations.status, "running"),
      ),
    );
}

/**
 * Stores the finished clip and settles the money that paid for it.
 *
 * The reservation is reconciled to what was actually charged. When the provider
 * reports nothing, the estimate stands, which is honest: it is what we reserved
 * and it is the only figure anybody can substantiate.
 */
export async function completeSceneClipGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  actualCostCents: number | null;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    etag: string | null;
    width: number | null;
    height: number | null;
    durationMilliseconds: number | null;
  };
}) {
  const generation = await findSceneClipGeneration(input);
  if (!generation) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded")
    return { generation, completed: false as const };

  const reservation = await findSceneClipReservation(input);
  if (!reservation) throw new Error("SCENE_CLIP_RESERVATION_NOT_FOUND");

  const actualCostCents =
    input.actualCostCents ?? generation.estimatedCostCents;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  assertNonnegativeInteger(input.asset.sizeBytes, "asset_size_bytes");

  const eventMetadata = JSON.stringify({
    generationId: input.generationId,
    durationMilliseconds: input.asset.durationMilliseconds,
  });

  await getDatabase().execute(sql`
    with settled_generation as (
      update scene_video_generations
      set
        status = 'succeeded'::scene_clip_status,
        progress_percent = 100,
        actual_cost_cents = ${actualCostCents},
        asset_object_key = ${input.asset.objectKey},
        asset_content_type = ${input.asset.contentType},
        asset_size_bytes = ${input.asset.sizeBytes},
        asset_etag = ${input.asset.etag},
        asset_width = ${input.asset.width},
        asset_height = ${input.asset.height},
        duration_milliseconds = ${input.asset.durationMilliseconds},
        error_category = null,
        safe_error_message = null,
        completed_at = now(),
        updated_at = now()
      where workspace_id = ${input.workspaceId}
        and project_id = ${input.projectId}
        and id = ${input.generationId}
        and status in ('pending', 'queued', 'running')
      returning id
    ),
    settled_reservation as (
      update usage_reservations
      set status = 'reconciled'::usage_reservation_status,
          actual_cost_cents = ${actualCostCents},
          updated_at = now()
      from settled_generation
      where usage_reservations.id = ${reservation.id}
        and usage_reservations.status = 'pending'
      returning usage_reservations.id
    )
    insert into usage_events (
      id, workspace_id, project_id, reservation_id, operation_type,
      event_type, estimated_cost_cents, actual_cost_cents, safe_metadata
    )
    select
      ${createUsageEventId(reservation.id, "reconciled")}::uuid,
      ${input.workspaceId}::uuid,
      ${input.projectId}::uuid,
      settled_reservation.id,
      'scene_video_generation'::usage_operation_type,
      'reconciled'::usage_event_type,
      ${generation.estimatedCostCents},
      ${actualCostCents},
      ${eventMetadata}::jsonb
    from settled_reservation
    on conflict (id) do nothing
  `);

  const updated = await findSceneClipGeneration(input);
  if (!updated) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  return { generation: updated, completed: true as const };
}

/**
 * Marks the clip failed and gives the money back.
 *
 * Released rather than reconciled whenever the provider did not bill, because
 * a failed job that cost nothing must not eat into a budget. A provider that
 * did charge is reconciled instead, so the spend is recorded even though there
 * is nothing to show for it.
 */
export async function failSceneClipGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  category: string;
  safeErrorMessage: string;
  actualCostCents?: number;
}) {
  const actualCostCents = input.actualCostCents ?? 0;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");

  const generation = await findSceneClipGeneration(input);
  if (!generation) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded")
    throw new Error("SCENE_CLIP_GENERATION_ALREADY_SUCCEEDED");
  if (generation.status === "failed")
    return { generation, failed: false as const };

  const reservation = await findSceneClipReservation(input);
  if (!reservation) throw new Error("SCENE_CLIP_RESERVATION_NOT_FOUND");

  const billed = actualCostCents > 0;
  const eventType = billed ? "reconciled" : "released";
  const eventMetadata = JSON.stringify({
    generationId: input.generationId,
    category: input.category,
    providerBilled: billed,
  });

  await getDatabase().execute(sql`
    with settled_generation as (
      update scene_video_generations
      set
        status = 'failed'::scene_clip_status,
        actual_cost_cents = ${actualCostCents},
        error_category = ${input.category},
        safe_error_message = ${input.safeErrorMessage},
        completed_at = now(),
        updated_at = now()
      where workspace_id = ${input.workspaceId}
        and project_id = ${input.projectId}
        and id = ${input.generationId}
        and status in ('pending', 'queued', 'running')
      returning id
    ),
    settled_reservation as (
      update usage_reservations
      set status = ${billed ? sql`'reconciled'::usage_reservation_status` : sql`'released'::usage_reservation_status`},
          actual_cost_cents = ${actualCostCents},
          updated_at = now()
      from settled_generation
      where usage_reservations.id = ${reservation.id}
        and usage_reservations.status = 'pending'
      returning usage_reservations.id
    )
    insert into usage_events (
      id, workspace_id, project_id, reservation_id, operation_type,
      event_type, estimated_cost_cents, actual_cost_cents, safe_metadata
    )
    select
      ${createUsageEventId(reservation.id, eventType)}::uuid,
      ${input.workspaceId}::uuid,
      ${input.projectId}::uuid,
      settled_reservation.id,
      'scene_video_generation'::usage_operation_type,
      ${eventType}::usage_event_type,
      ${generation.estimatedCostCents},
      ${actualCostCents},
      ${eventMetadata}::jsonb
    from settled_reservation
    on conflict (id) do nothing
  `);

  const updated = await findSceneClipGeneration(input);
  if (!updated) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  return { generation: updated, failed: true as const };
}

/**
 * Approves or rejects a finished clip.
 *
 * Approving demotes whatever was approved before for the same scene and shape,
 * in the same statement, because the database allows only one and two writes
 * would leave a moment where the scene had none or, worse, a moment where the
 * second write failed and the scene had the old one back.
 */
export async function reviewSceneClip(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  reviewStatus: "approved" | "rejected";
  reviewedByUserId: string;
}) {
  const generation = await findSceneClipGeneration(input);
  if (!generation) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  if (input.reviewStatus === "approved" && generation.status !== "succeeded")
    throw new Error("SCENE_CLIP_NOT_SUCCEEDED");

  await getDatabase().execute(sql`
    with demoted as (
      update scene_video_generations
      set review_status = 'rejected'::scene_clip_review_status,
          updated_at = now()
      where workspace_id = ${input.workspaceId}
        and project_id = ${input.projectId}
        and scene_version_id = ${generation.sceneVersionId}
        and coalesce(output_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(${generation.outputVariantId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        and id <> ${input.generationId}
        and review_status = 'approved'
        and ${input.reviewStatus === "approved"}
      returning id
    )
    update scene_video_generations
    set review_status = ${input.reviewStatus}::scene_clip_review_status,
        reviewed_by_user_id = ${input.reviewedByUserId}::uuid,
        reviewed_at = now(),
        updated_at = now()
    where workspace_id = ${input.workspaceId}
      and project_id = ${input.projectId}
      and id = ${input.generationId}
  `);

  const updated = await findSceneClipGeneration(input);
  if (!updated) throw new Error("SCENE_CLIP_GENERATION_NOT_FOUND");
  return updated;
}
