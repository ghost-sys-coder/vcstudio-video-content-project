import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE,
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
} from "@studio/prompts";
import {
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE,
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_OUTPAINT_PROMPT_VERSION,
} from "@studio/prompts";
import { getDatabase } from "@/db/drizzle";
import {
  promptTemplateVersions,
  providerRequests,
  sceneImageGenerations,
  stylePresets,
  stylePresetVersions,
  type ProjectAspectRatio,
} from "@/db/schema";
import {
  findApprovedCurrentSceneVersion,
  findEligibleSceneReferenceAssetsByIds,
  findPromptTemplateVersion,
  findSceneImageGeneration,
  findSceneImageGenerationByIdempotencyKey,
  findSceneImageGenerationByRequestNonce,
  findSceneImageProviderRequest,
  findSceneImageReservation,
  findStylePresetVersion,
  getNextSceneImageGenerationVersion,
} from "@/db/repositories/scene-images.repository";
import { BudgetExceededError } from "@/lib/domain/errors";
import { assertSceneImageReferenceSelection } from "@/lib/domain/scene-image-references";

export const SCENE_IMAGE_PROMPT_TEMPLATE_KEY = "scene-image";

/**
 * Ensure the versioned scene-image prompt-template row exists. Runs
 * `INSERT ... ON CONFLICT DO NOTHING` so a new prompt version works whether the
 * schema was applied via `db:migrate` (seed included) or `drizzle-kit push`
 * (schema only, seed skipped). Mirrors `ensureCharacterReferencePromptTemplate`.
 */
export async function ensureSceneImagePromptTemplate(): Promise<void> {
  await getDatabase()
    .insert(promptTemplateVersions)
    .values({
      templateKey: SCENE_IMAGE_PROMPT_TEMPLATE_KEY,
      version: SCENE_IMAGE_PROMPT_VERSION,
      sourceHash: SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();
}

export async function ensureSceneOutpaintPromptTemplate(): Promise<void> {
  await getDatabase()
    .insert(promptTemplateVersions)
    .values({
      templateKey: "scene-outpaint",
      version: SCENE_OUTPAINT_PROMPT_VERSION,
      sourceHash: SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();
}

type SafeMetadata = Record<string, string | number | boolean | null>;
type ImageQuality = typeof sceneImageGenerations.$inferInsert.quality;
type ImageOutputFormat = typeof sceneImageGenerations.$inferInsert.outputFormat;

type ProviderUsage = {
  textInputUnits: number | null;
  imageInputUnits: number | null;
  outputUnits: number | null;
};

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
  if (typeof error !== "object" || error === null) return null;
  const value = Reflect.get(error, field);
  return typeof value === "string" ? value : null;
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

function assertProviderUsage(usage: ProviderUsage): void {
  assertNonnegativeInteger(usage.textInputUnits, "text_input_units");
  assertNonnegativeInteger(usage.imageInputUnits, "image_input_units");
  assertNonnegativeInteger(usage.outputUnits, "output_units");
}

function generationMatchesRequest(
  generation: typeof sceneImageGenerations.$inferSelect,
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

export async function createSceneImageGenerationReservation(input: {
  generationId: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  purpose?: "scene" | "variant_outpaint";
  outputVariantId?: string | null;
  sourceImageGenerationId?: string | null;
  stylePresetVersionId: string;
  promptTemplateVersionId: string;
  generationVersion: number;
  requestNonce: string;
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  quality: ImageQuality;
  size: string;
  outputFormat: ImageOutputFormat;
  outputCompression: number;
  background: "opaque" | "auto";
  inputFidelity: string | null;
  promptTemplateKey: string;
  promptTemplateVersion: string;
  stylePresetVersion: number;
  finalPrompt: string;
  estimatedCostCents: number;
  requestedByUserId: string;
  batchId?: string | null;
  expiresAt: Date;
  budget: {
    workspaceDailyLimitCents: number;
    workspaceMonthlyLimitCents: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
  };
  referenceAssetIds: string[];
}) {
  if (!Number.isInteger(input.generationVersion) || input.generationVersion < 1)
    throw new Error("INVALID_SCENE_IMAGE_GENERATION_VERSION");
  assertNonnegativeInteger(input.estimatedCostCents, "estimated_cost_cents");
  assertNonnegativeInteger(
    input.budget.workspaceDailyLimitCents,
    "workspace_daily_limit_cents",
  );
  assertNonnegativeInteger(
    input.budget.workspaceMonthlyLimitCents,
    "workspace_monthly_limit_cents",
  );
  if (
    Number.isNaN(input.budget.dailyWindowStart.getTime()) ||
    Number.isNaN(input.budget.monthlyWindowStart.getTime())
  )
    throw new Error("INVALID_SCENE_IMAGE_BUDGET_WINDOW");
  if (
    !Number.isInteger(input.outputCompression) ||
    input.outputCompression < 1 ||
    input.outputCompression > 100
  )
    throw new Error("INVALID_SCENE_IMAGE_OUTPUT_COMPRESSION");
  if (input.background !== "opaque" && input.background !== "auto")
    throw new Error("INVALID_SCENE_IMAGE_BACKGROUND");

  const sortedReferenceAssetIds = [...input.referenceAssetIds].sort();

  const existingNonce = await findSceneImageGenerationByRequestNonce({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    requestNonce: input.requestNonce,
  });
  if (existingNonce) {
    if (!generationMatchesRequest(existingNonce, input))
      throw new Error("SCENE_IMAGE_REQUEST_NONCE_CONFLICT");
    return { generation: existingNonce, created: false as const };
  }

  const existingIdempotency = await findSceneImageGenerationByIdempotencyKey({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existingIdempotency) {
    if (!generationMatchesRequest(existingIdempotency, input))
      throw new Error("SCENE_IMAGE_IDEMPOTENCY_CONFLICT");
    return { generation: existingIdempotency, created: false as const };
  }

  const [approvedScene, stylePreset, promptTemplate, references, nextVersion] =
    await Promise.all([
      findApprovedCurrentSceneVersion({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sceneId: input.sceneId,
        sceneVersionId: input.sceneVersionId,
      }),
      findStylePresetVersion({
        workspaceId: input.workspaceId,
        stylePresetVersionId: input.stylePresetVersionId,
      }),
      findPromptTemplateVersion({
        templateKey: input.promptTemplateKey,
        version: input.promptTemplateVersion,
      }),
      findEligibleSceneReferenceAssetsByIds({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sceneVersionId: input.sceneVersionId,
        referenceAssetIds: sortedReferenceAssetIds,
      }),
      getNextSceneImageGenerationVersion({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sceneVersionId: input.sceneVersionId,
      }),
    ]);

  if (!approvedScene) throw new Error("APPROVED_SCENE_VERSION_NOT_FOUND");
  if (!stylePreset) throw new Error("STYLE_PRESET_VERSION_NOT_FOUND");
  if (stylePreset.version.version !== input.stylePresetVersion)
    throw new Error("STYLE_PRESET_VERSION_MISMATCH");
  if (!promptTemplate || promptTemplate.id !== input.promptTemplateVersionId)
    throw new Error("PROMPT_TEMPLATE_VERSION_NOT_FOUND");
  if (nextVersion !== input.generationVersion)
    throw new Error("SCENE_IMAGE_GENERATION_VERSION_CONFLICT");

  assertSceneImageReferenceSelection({
    selectedReferenceAssetIds: sortedReferenceAssetIds,
    eligibleReferenceAssetIds: references.map(({ reference }) => reference.id),
  });

  const referenceById = new Map(
    references.map((result) => [result.reference.id, result] as const),
  );
  const referenceSnapshots = sortedReferenceAssetIds.map(
    (referenceId, position) => {
      const result = referenceById.get(referenceId);
      if (!result) throw new Error("SCENE_IMAGE_REFERENCE_NOT_ELIGIBLE");
      const etag = result.reference.etag?.trim();
      if (!etag) throw new Error("SCENE_IMAGE_REFERENCE_ETAG_MISSING");
      return {
        workspaceId: input.workspaceId,
        generationId: input.generationId,
        referenceAssetId: result.reference.id,
        referenceAssetIdSnapshot: result.reference.id,
        characterId: result.character.id,
        objectKeySnapshot: result.reference.objectKey,
        contentTypeSnapshot: result.reference.contentType,
        etagSnapshot: etag,
        referenceTypeSnapshot: result.reference.type,
        position,
      };
    },
  );

  const referenceSnapshotJson = JSON.stringify(
    referenceSnapshots.map((snapshot) => ({
      reference_asset_id: snapshot.referenceAssetId,
      reference_asset_id_snapshot: snapshot.referenceAssetIdSnapshot,
      character_id: snapshot.characterId,
      object_key_snapshot: snapshot.objectKeySnapshot,
      content_type_snapshot: snapshot.contentTypeSnapshot,
      etag_snapshot: snapshot.etagSnapshot,
      reference_type_snapshot: snapshot.referenceTypeSnapshot,
      position: snapshot.position,
    })),
  );
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
        insert into scene_image_generations (
          id, workspace_id, project_id, scene_id, scene_version_id,
          purpose, output_variant_id, source_image_generation_id,
          style_preset_version_id, prompt_template_version_id,
          generation_version, request_nonce, idempotency_key,
          request_fingerprint, model, quality, size, output_format,
          output_compression, background, input_fidelity, prompt_template_version,
          style_preset_version, final_prompt, estimated_cost_cents,
          requested_by_user_id, batch_id
        )
        select
          ${input.generationId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          ${input.sceneId}::uuid,
          ${input.sceneVersionId}::uuid,
          ${input.purpose ?? "scene"}::image_generation_purpose,
          ${input.outputVariantId ?? null}::uuid,
          ${input.sourceImageGenerationId ?? null}::uuid,
          ${input.stylePresetVersionId}::uuid,
          ${input.promptTemplateVersionId}::uuid,
          ${input.generationVersion},
          ${input.requestNonce}::uuid,
          ${input.idempotencyKey},
          ${input.requestFingerprint},
          ${input.model},
          ${input.quality}::image_quality,
          ${input.size},
          ${input.outputFormat}::image_output_format,
          ${input.outputCompression},
          ${input.background},
          ${input.inputFidelity}::text,
          ${input.promptTemplateVersion},
          ${input.stylePresetVersion},
          ${input.finalPrompt},
          ${input.estimatedCostCents},
          ${input.requestedByUserId}::uuid,
          ${input.batchId ?? null}::uuid
        from eligible
        returning id
      ),
      inserted_reservation as (
        insert into usage_reservations (
          id, workspace_id, project_id, operation_type,
          image_generation_id, reserved_cost_cents, expires_at
        )
        select
          ${input.reservationId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          'scene_image_generation'::usage_operation_type,
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
          'scene_image_generation'::usage_operation_type,
          'reserved'::usage_event_type,
          ${input.estimatedCostCents},
          ${reservedEventMetadata}::jsonb
        from inserted_reservation
        returning id
      ),
      reference_rows as materialized (
        select *
        from jsonb_to_recordset(${referenceSnapshotJson}::jsonb) as reference_row(
          reference_asset_id uuid,
          reference_asset_id_snapshot uuid,
          character_id uuid,
          object_key_snapshot text,
          content_type_snapshot text,
          etag_snapshot text,
          reference_type_snapshot character_reference_type,
          position integer
        )
      ),
      inserted_references as (
        insert into generation_reference_assets (
          workspace_id, generation_id, reference_asset_id,
          reference_asset_id_snapshot, character_id, object_key_snapshot,
          content_type_snapshot, etag_snapshot, reference_type_snapshot,
          position
        )
        select
          ${input.workspaceId}::uuid,
          inserted_generation.id,
          reference_rows.reference_asset_id,
          reference_rows.reference_asset_id_snapshot,
          reference_rows.character_id,
          reference_rows.object_key_snapshot,
          reference_rows.content_type_snapshot,
          reference_rows.etag_snapshot,
          reference_rows.reference_type_snapshot,
          reference_rows.position
        from inserted_generation
        cross join reference_rows
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
        "scene_image_generations_workspace_request_nonce_unique",
      ) ||
      isUniqueConstraintError(
        error,
        "scene_image_generations_idempotency_unique",
      )
    ) {
      const existing = await findSceneImageGenerationByRequestNonce({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        requestNonce: input.requestNonce,
      });
      if (existing && generationMatchesRequest(existing, input))
        return { generation: existing, created: false as const };
    }
    if (
      isUniqueConstraintError(error, "scene_image_generations_version_unique")
    )
      throw new Error("SCENE_IMAGE_GENERATION_VERSION_CONFLICT");
    throw error;
  }

  const generation = await findSceneImageGeneration({
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

export async function attachSceneImageTriggerRun(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  triggerRunId: string;
}) {
  const current = await findSceneImageGeneration(input);
  if (!current) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (
    current.triggerRunId === input.triggerRunId &&
    ["queued", "running", "succeeded"].includes(current.status)
  )
    return current;
  if (
    current.triggerRunId ||
    !["pending", "queued", "running", "succeeded"].includes(current.status)
  )
    throw new Error("SCENE_IMAGE_TRIGGER_RUN_CONFLICT");

  const [updated] = await getDatabase()
    .update(sceneImageGenerations)
    .set({
      triggerRunId: input.triggerRunId,
      status: sql`case when ${sceneImageGenerations.status} = 'pending' then 'queued'::image_generation_status else ${sceneImageGenerations.status} end`,
      progressPercent: sql`case when ${sceneImageGenerations.status} = 'pending' then greatest(${sceneImageGenerations.progressPercent}, 5) else ${sceneImageGenerations.progressPercent} end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.id, input.generationId),
        isNull(sceneImageGenerations.triggerRunId),
        inArray(sceneImageGenerations.status, [
          "pending",
          "queued",
          "running",
          "succeeded",
        ]),
      ),
    )
    .returning();
  if (!updated) {
    const latest = await findSceneImageGeneration(input);
    if (
      latest?.triggerRunId === input.triggerRunId &&
      ["queued", "running", "succeeded"].includes(latest.status)
    )
      return latest;
    throw new Error("SCENE_IMAGE_TRIGGER_RUN_CONFLICT");
  }
  return updated;
}

export async function syncSceneImageGenerationRunning(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const now = new Date();
  const [updated] = await getDatabase()
    .update(sceneImageGenerations)
    .set({
      status: "running",
      progressPercent: 15,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.id, input.generationId),
        inArray(sceneImageGenerations.status, ["pending", "queued"]),
      ),
    )
    .returning();
  if (updated) return updated;

  const current = await findSceneImageGeneration(input);
  if (current?.status === "running" || current?.status === "succeeded")
    return current;
  throw new Error("SCENE_IMAGE_RUNNING_TRANSITION_CONFLICT");
}

export async function startSceneImageProviderAttempt(input: {
  providerRequestId: string;
  workspaceId: string;
  projectId: string;
  generationId: string;
  provider: string;
  model: string;
  idempotencyKey: string;
  attemptNumber: number;
  estimatedCostCents: number;
}) {
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1)
    throw new Error("INVALID_PROVIDER_ATTEMPT_NUMBER");
  assertNonnegativeInteger(input.estimatedCostCents, "estimated_cost_cents");

  const generation = await findSceneImageGeneration(input);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded")
    return { generation, providerRequest: null, created: false as const };
  if (generation.status === "failed" || generation.status === "cancelled")
    throw new Error("SCENE_IMAGE_GENERATION_TERMINAL");
  if (generation.model !== input.model)
    throw new Error("SCENE_IMAGE_PROVIDER_MODEL_MISMATCH");
  if (generation.estimatedCostCents !== input.estimatedCostCents)
    throw new Error("SCENE_IMAGE_PROVIDER_ESTIMATE_MISMATCH");

  const existingAttempt = await findSceneImageProviderRequest({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationId: input.generationId,
    attemptNumber: input.attemptNumber,
  });
  if (existingAttempt)
    return {
      generation,
      providerRequest: existingAttempt,
      created: false as const,
    };

  let claimedProviderRequest = false;
  try {
    const result = await getDatabase().execute<{ id: string }>(sql`
      with claimed_generation as (
        update scene_image_generations generation
        set
          status = 'running'::image_generation_status,
          progress_percent = 25,
          attempt_count = greatest(generation.attempt_count, ${input.attemptNumber}),
          started_at = coalesce(generation.started_at, now()),
          updated_at = now()
        where generation.workspace_id = ${input.workspaceId}
          and generation.project_id = ${input.projectId}
          and generation.id = ${input.generationId}
          and generation.status in ('pending', 'queued', 'running')
          and generation.model = ${input.model}
          and generation.estimated_cost_cents = ${input.estimatedCostCents}
          and ${input.attemptNumber} = (
            select coalesce(max(previous.attempt_number), 0) + 1
            from provider_requests previous
            where previous.workspace_id = ${input.workspaceId}
              and previous.project_id = ${input.projectId}
              and previous.generation_id = generation.id
          )
          and not exists (
            select 1
            from provider_requests previous
            where previous.workspace_id = ${input.workspaceId}
              and previous.project_id = ${input.projectId}
              and previous.generation_id = generation.id
              and (
                previous.status in ('pending', 'running', 'succeeded')
                or coalesce(previous.actual_cost_cents, 0) > 0
              )
          )
          and exists (
            select 1
            from usage_reservations reservation
            where reservation.workspace_id = ${input.workspaceId}
              and reservation.project_id = ${input.projectId}
              and reservation.operation_type = 'scene_image_generation'
              and reservation.image_generation_id = generation.id
              and reservation.status = 'pending'
              and reservation.expires_at > now()
              and reservation.reserved_cost_cents = generation.estimated_cost_cents
          )
        returning generation.id
      ),
      inserted_request as (
        insert into provider_requests (
          id, workspace_id, project_id, generation_id, provider, model,
          status, idempotency_key, attempt_number, estimated_cost_cents,
          started_at
        )
        select
          ${input.providerRequestId}::uuid,
          ${input.workspaceId}::uuid,
          ${input.projectId}::uuid,
          claimed_generation.id,
          ${input.provider},
          ${input.model},
          'running'::provider_request_status,
          ${input.idempotencyKey},
          ${input.attemptNumber},
          ${input.estimatedCostCents},
          now()
        from claimed_generation
        returning id
      )
      select id from inserted_request
    `);
    claimedProviderRequest = result.rows.length === 1;
  } catch (error) {
    if (
      isUniqueConstraintError(
        error,
        "provider_requests_generation_attempt_unique",
      ) ||
      isUniqueConstraintError(error, "provider_requests_idempotency_unique")
    ) {
      const request = await findSceneImageProviderRequest({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generationId: input.generationId,
        attemptNumber: input.attemptNumber,
      });
      if (request)
        return {
          generation,
          providerRequest: request,
          created: false as const,
        };
    }
    throw error;
  }

  const providerRequest = await findSceneImageProviderRequest({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationId: input.generationId,
    attemptNumber: input.attemptNumber,
  });
  if (!providerRequest) {
    const reservation = await findSceneImageReservation(input);
    if (!reservation || reservation.status !== "pending")
      throw new Error("SCENE_IMAGE_RESERVATION_NOT_PENDING");
    if (reservation.expiresAt.getTime() <= Date.now())
      throw new Error("SCENE_IMAGE_RESERVATION_EXPIRED");
    throw new Error("PROVIDER_REQUEST_CREATE_FAILED");
  }
  if (!claimedProviderRequest)
    return { generation, providerRequest, created: false as const };
  return { generation, providerRequest, created: true as const };
}

export async function failSceneImageProviderAttempt(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber: number;
  errorCode: string;
  safeErrorMessage: string;
  actualCostCents?: number;
  safeMetadata?: SafeMetadata;
}) {
  const actualCostCents = input.actualCostCents ?? null;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  const [updated] = await getDatabase()
    .update(providerRequests)
    .set({
      status: "failed",
      actualCostCents,
      errorCode: input.errorCode,
      safeErrorMessage: input.safeErrorMessage,
      safeMetadata: input.safeMetadata ?? {},
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(providerRequests.workspaceId, input.workspaceId),
        eq(providerRequests.projectId, input.projectId),
        eq(providerRequests.generationId, input.generationId),
        eq(providerRequests.attemptNumber, input.attemptNumber),
        inArray(providerRequests.status, ["pending", "running"]),
      ),
    )
    .returning();
  if (updated) return updated;

  const existing = await findSceneImageProviderRequest(input);
  if (existing?.status === "failed") return existing;
  throw new Error("PROVIDER_REQUEST_NOT_RUNNING");
}

export async function completeSceneImageProviderAttempt(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber: number;
  providerRequestIdentifier: string | null;
  usage: ProviderUsage;
  actualCostCents: number;
  safeMetadata?: SafeMetadata;
}) {
  assertProviderUsage(input.usage);
  assertNonnegativeInteger(input.actualCostCents, "actual_cost_cents");

  const existing = await findSceneImageProviderRequest(input);
  if (!existing) throw new Error("PROVIDER_REQUEST_NOT_FOUND");
  if (existing.status === "succeeded") {
    if (
      existing.providerRequestId !== input.providerRequestIdentifier ||
      existing.actualCostCents !== input.actualCostCents ||
      existing.textInputUnits !== input.usage.textInputUnits ||
      existing.imageInputUnits !== input.usage.imageInputUnits ||
      existing.outputUnits !== input.usage.outputUnits
    )
      throw new Error("PROVIDER_REQUEST_COMPLETION_CONFLICT");
    return existing;
  }
  if (existing.status === "failed")
    throw new Error("PROVIDER_REQUEST_ALREADY_FAILED");

  const now = new Date();
  const [requests] = await getDatabase().batch([
    getDatabase()
      .update(providerRequests)
      .set({
        status: "succeeded",
        providerRequestId: input.providerRequestIdentifier,
        textInputUnits: input.usage.textInputUnits,
        imageInputUnits: input.usage.imageInputUnits,
        outputUnits: input.usage.outputUnits,
        actualCostCents: input.actualCostCents,
        safeMetadata: input.safeMetadata ?? {},
        errorCode: null,
        safeErrorMessage: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(providerRequests.workspaceId, input.workspaceId),
          eq(providerRequests.projectId, input.projectId),
          eq(providerRequests.generationId, input.generationId),
          eq(providerRequests.attemptNumber, input.attemptNumber),
          inArray(providerRequests.status, ["pending", "running"]),
        ),
      )
      .returning(),
    getDatabase()
      .update(sceneImageGenerations)
      .set({ progressPercent: 75, updatedAt: now })
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, input.workspaceId),
          eq(sceneImageGenerations.projectId, input.projectId),
          eq(sceneImageGenerations.id, input.generationId),
          eq(sceneImageGenerations.status, "running"),
        ),
      ),
  ]);
  const updated = requests[0];
  if (updated) return updated;

  const current = await findSceneImageProviderRequest(input);
  if (
    current?.status === "succeeded" &&
    current.providerRequestId === input.providerRequestIdentifier &&
    current.actualCostCents === input.actualCostCents
  )
    return current;
  throw new Error("PROVIDER_REQUEST_COMPLETION_CONFLICT");
}

export async function completeSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber: number;
  providerRequestIdentifier: string | null;
  usage: ProviderUsage;
  actualCostCents: number | null;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
    etag: string | null;
  };
  safeMetadata?: SafeMetadata;
}) {
  assertProviderUsage(input.usage);
  assertNonnegativeInteger(input.actualCostCents, "actual_cost_cents");
  assertNonnegativeInteger(input.asset.sizeBytes, "asset_size_bytes");
  assertNonnegativeInteger(input.asset.width, "asset_width");
  assertNonnegativeInteger(input.asset.height, "asset_height");
  if (
    input.asset.sizeBytes === 0 ||
    input.asset.width === 0 ||
    input.asset.height === 0
  )
    throw new Error("INVALID_SCENE_IMAGE_ASSET");

  const [generation, request, reservation] = await Promise.all([
    findSceneImageGeneration(input),
    findSceneImageProviderRequest(input),
    findSceneImageReservation(input),
  ]);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded") {
    if (
      generation.assetObjectKey !== input.asset.objectKey ||
      generation.assetContentType !== input.asset.contentType ||
      generation.assetSizeBytes !== input.asset.sizeBytes ||
      generation.assetWidth !== input.asset.width ||
      generation.assetHeight !== input.asset.height ||
      generation.actualCostCents !==
        (input.actualCostCents ?? request?.actualCostCents ?? null)
    )
      throw new Error("SCENE_IMAGE_COMPLETION_CONFLICT");
    return { generation, completed: false as const };
  }
  if (generation.status === "failed" || generation.status === "cancelled")
    throw new Error("SCENE_IMAGE_GENERATION_TERMINAL");
  if (!request) throw new Error("PROVIDER_REQUEST_NOT_FOUND");
  if (request.status === "failed") throw new Error("PROVIDER_REQUEST_FAILED");
  if (!reservation) throw new Error("SCENE_IMAGE_RESERVATION_NOT_FOUND");
  if (reservation.status !== "pending")
    throw new Error("SCENE_IMAGE_RESERVATION_NOT_PENDING");

  const providerRequestIdentifier =
    input.providerRequestIdentifier ?? request.providerRequestId;
  const actualCostCents = input.actualCostCents ?? request.actualCostCents;
  if (actualCostCents === null) throw new Error("PROVIDER_ACTUAL_COST_MISSING");
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  const usage = {
    textInputUnits: input.usage.textInputUnits ?? request.textInputUnits,
    imageInputUnits: input.usage.imageInputUnits ?? request.imageInputUnits,
    outputUnits: input.usage.outputUnits ?? request.outputUnits,
  };
  const usageEventMetadata = JSON.stringify({
    ...(input.safeMetadata ?? request.safeMetadata),
    generationId: input.generationId,
    providerRequestIdentifier,
  });
  const result = await getDatabase().execute<{ id: string }>(sql`
    with eligible as materialized (
      select generation.id
      from scene_image_generations generation
      inner join provider_requests provider_request
        on provider_request.workspace_id = generation.workspace_id
        and provider_request.project_id = generation.project_id
        and provider_request.generation_id = generation.id
        and provider_request.attempt_number = ${input.attemptNumber}
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'scene_image_generation'
        and reservation.image_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.generationId}
        and generation.status in ('pending', 'queued', 'running')
        and provider_request.status = 'succeeded'
        and provider_request.provider_request_id is not distinct from ${providerRequestIdentifier}
        and provider_request.actual_cost_cents = ${actualCostCents}
        and provider_request.text_input_units is not distinct from ${usage.textInputUnits}
        and provider_request.image_input_units is not distinct from ${usage.imageInputUnits}
        and provider_request.output_units is not distinct from ${usage.outputUnits}
        and reservation.status = 'pending'
      for update of generation, provider_request, reservation
    ),
    transitioned_generation as (
      update scene_image_generations generation
      set
        status = 'succeeded'::image_generation_status,
        progress_percent = 100,
        actual_cost_cents = ${actualCostCents},
        asset_object_key = ${input.asset.objectKey},
        asset_content_type = ${input.asset.contentType},
        asset_size_bytes = ${input.asset.sizeBytes},
        asset_width = ${input.asset.width},
        asset_height = ${input.asset.height},
        asset_etag = ${input.asset.etag},
        error_category = null,
        safe_error_message = null,
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
        and generation.status in ('pending', 'queued', 'running')
      returning generation.id
    ),
    transitioned_reservation as (
      update usage_reservations reservation
      set
        status = 'reconciled'::usage_reservation_status,
        actual_cost_cents = ${actualCostCents},
        updated_at = now()
      from transitioned_generation
      where reservation.workspace_id = ${input.workspaceId}
        and reservation.project_id = ${input.projectId}
        and reservation.operation_type = 'scene_image_generation'
        and reservation.image_generation_id = transitioned_generation.id
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
        'scene_image_generation'::usage_operation_type,
        'reconciled'::usage_event_type,
        transitioned_reservation.reserved_cost_cents,
        ${actualCostCents},
        ${usageEventMetadata}::jsonb
      from transitioned_reservation
      inner join transitioned_generation on true
      returning id
    )
    select transitioned_generation.id
    from transitioned_generation
    inner join transitioned_reservation on true
    inner join inserted_event on true
  `);
  if (result.rows.length === 1) {
    const completed = await findSceneImageGeneration(input);
    if (!completed || completed.status !== "succeeded")
      throw new Error("SCENE_IMAGE_COMPLETION_CONFLICT");
    return { generation: completed, completed: true as const };
  }

  const current = await findSceneImageGeneration(input);
  if (
    current?.status === "succeeded" &&
    current.assetObjectKey === input.asset.objectKey &&
    current.assetContentType === input.asset.contentType &&
    current.assetSizeBytes === input.asset.sizeBytes &&
    current.assetWidth === input.asset.width &&
    current.assetHeight === input.asset.height &&
    current.actualCostCents === actualCostCents
  )
    return { generation: current, completed: false as const };
  throw new Error("SCENE_IMAGE_COMPLETION_CONFLICT");
}

export async function failSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber?: number;
  category: string;
  safeErrorMessage: string;
  providerRequestStatus?: "succeeded" | "failed";
  providerRequestIdentifier?: string;
  usage?: ProviderUsage;
  actualCostCents?: number;
  errorCode?: string;
  safeMetadata?: SafeMetadata;
}) {
  const actualCostCents = input.actualCostCents ?? 0;
  assertNonnegativeInteger(actualCostCents, "actual_cost_cents");
  if (input.usage) assertProviderUsage(input.usage);
  const providerBilled =
    input.providerRequestStatus === "succeeded" || actualCostCents > 0;

  const [generation, reservation, request] = await Promise.all([
    findSceneImageGeneration(input),
    findSceneImageReservation(input),
    input.attemptNumber === undefined
      ? Promise.resolve(null)
      : findSceneImageProviderRequest({
          ...input,
          attemptNumber: input.attemptNumber,
        }),
  ]);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status === "succeeded")
    throw new Error("SCENE_IMAGE_GENERATION_ALREADY_SUCCEEDED");
  if (generation.status === "failed")
    return { generation, failed: false as const };
  if (!reservation) throw new Error("SCENE_IMAGE_RESERVATION_NOT_FOUND");
  if (reservation.status !== "pending")
    throw new Error("SCENE_IMAGE_RESERVATION_NOT_PENDING");
  if (providerBilled && !request)
    throw new Error("BILLED_PROVIDER_REQUEST_NOT_FOUND");

  const reservationStatus = providerBilled ? "reconciled" : "released";
  const eventType = providerBilled ? "reconciled" : "released";
  const eventMetadata = JSON.stringify({
    generationId: input.generationId,
    category: input.category,
    providerBilled,
  });
  const eventId = createUsageEventId(reservation.id, eventType);
  let transitionRows: Array<{ id: string }>;

  if (request) {
    const providerRequestStatus = input.providerRequestStatus ?? "failed";
    const providerRequestIdentifier =
      input.providerRequestIdentifier ?? request.providerRequestId;
    const usage = {
      textInputUnits: input.usage?.textInputUnits ?? request.textInputUnits,
      imageInputUnits: input.usage?.imageInputUnits ?? request.imageInputUnits,
      outputUnits: input.usage?.outputUnits ?? request.outputUnits,
    };
    const safeMetadata = JSON.stringify(
      input.safeMetadata ?? request.safeMetadata,
    );
    const providerEligibility =
      providerRequestStatus === "succeeded"
        ? sql`
            provider_request.status = 'succeeded'
            and provider_request.provider_request_id is not distinct from ${providerRequestIdentifier}
            and provider_request.actual_cost_cents = ${actualCostCents}
            and provider_request.text_input_units is not distinct from ${usage.textInputUnits}
            and provider_request.image_input_units is not distinct from ${usage.imageInputUnits}
            and provider_request.output_units is not distinct from ${usage.outputUnits}
          `
        : sql`provider_request.status in ('pending', 'running', 'failed')`;
    const providerUpdateGuard =
      providerRequestStatus === "succeeded"
        ? sql`provider_request.status = 'succeeded'`
        : sql`provider_request.status in ('pending', 'running', 'failed')`;

    const result = await getDatabase().execute<{ id: string }>(sql`
      with eligible as materialized (
        select generation.id, provider_request.id as provider_request_id
        from scene_image_generations generation
        inner join provider_requests provider_request
          on provider_request.workspace_id = generation.workspace_id
          and provider_request.project_id = generation.project_id
          and provider_request.generation_id = generation.id
          and provider_request.id = ${request.id}
          and provider_request.attempt_number = ${request.attemptNumber}
        inner join usage_reservations reservation
          on reservation.workspace_id = generation.workspace_id
          and reservation.project_id = generation.project_id
          and reservation.operation_type = 'scene_image_generation'
          and reservation.image_generation_id = generation.id
        where generation.workspace_id = ${input.workspaceId}
          and generation.project_id = ${input.projectId}
          and generation.id = ${input.generationId}
          and generation.status in ('pending', 'queued', 'running')
          and (${providerEligibility})
          and reservation.status = 'pending'
        for update of generation, provider_request, reservation
      ),
      transitioned_generation as (
        update scene_image_generations generation
        set
          status = 'failed'::image_generation_status,
          actual_cost_cents = ${actualCostCents},
          progress_percent = 100,
          error_category = ${input.category},
          safe_error_message = ${input.safeErrorMessage},
          completed_at = now(),
          updated_at = now()
        from eligible
        where generation.id = eligible.id
          and generation.status in ('pending', 'queued', 'running')
        returning generation.id
      ),
      transitioned_provider as (
        update provider_requests provider_request
        set
          status = cast(${providerRequestStatus} as provider_request_status),
          provider_request_id = ${providerRequestIdentifier},
          text_input_units = ${usage.textInputUnits},
          image_input_units = ${usage.imageInputUnits},
          output_units = ${usage.outputUnits},
          actual_cost_cents = ${actualCostCents},
          error_code = ${input.errorCode ?? input.category},
          safe_error_message = ${input.safeErrorMessage},
          safe_metadata = ${safeMetadata}::jsonb,
          completed_at = now(),
          updated_at = now()
        from eligible, transitioned_generation
        where provider_request.id = eligible.provider_request_id
          and (${providerUpdateGuard})
        returning provider_request.id
      ),
      transitioned_reservation as (
        update usage_reservations reservation
        set
          status = cast(${reservationStatus} as usage_reservation_status),
          actual_cost_cents = ${actualCostCents},
          updated_at = now()
        from transitioned_generation, transitioned_provider
        where reservation.workspace_id = ${input.workspaceId}
          and reservation.project_id = ${input.projectId}
          and reservation.operation_type = 'scene_image_generation'
          and reservation.image_generation_id = transitioned_generation.id
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
          'scene_image_generation'::usage_operation_type,
          cast(${eventType} as usage_event_type),
          transitioned_reservation.reserved_cost_cents,
          ${actualCostCents},
          ${eventMetadata}::jsonb
        from transitioned_reservation
        returning id
      )
      select transitioned_generation.id
      from transitioned_generation
      inner join transitioned_provider on true
      inner join transitioned_reservation on true
      inner join inserted_event on true
    `);
    transitionRows = result.rows;
  } else {
    const result = await getDatabase().execute<{ id: string }>(sql`
      with eligible as materialized (
        select generation.id
        from scene_image_generations generation
        inner join usage_reservations reservation
          on reservation.workspace_id = generation.workspace_id
          and reservation.project_id = generation.project_id
          and reservation.operation_type = 'scene_image_generation'
          and reservation.image_generation_id = generation.id
        where generation.workspace_id = ${input.workspaceId}
          and generation.project_id = ${input.projectId}
          and generation.id = ${input.generationId}
          and generation.status in ('pending', 'queued', 'running')
          and reservation.status = 'pending'
        for update of generation, reservation
      ),
      transitioned_generation as (
        update scene_image_generations generation
        set
          status = 'failed'::image_generation_status,
          actual_cost_cents = ${actualCostCents},
          progress_percent = 100,
          error_category = ${input.category},
          safe_error_message = ${input.safeErrorMessage},
          completed_at = now(),
          updated_at = now()
        from eligible
        where generation.id = eligible.id
          and generation.status in ('pending', 'queued', 'running')
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
          and reservation.operation_type = 'scene_image_generation'
          and reservation.image_generation_id = transitioned_generation.id
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
          'scene_image_generation'::usage_operation_type,
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
    transitionRows = result.rows;
  }

  if (transitionRows.length === 1) {
    const failed = await findSceneImageGeneration(input);
    if (!failed || failed.status !== "failed")
      throw new Error("SCENE_IMAGE_FAILURE_CONFLICT");
    return { generation: failed, failed: true as const };
  }

  const current = await findSceneImageGeneration(input);
  if (current?.status === "failed")
    return { generation: current, failed: false as const };
  if (current?.status === "succeeded")
    throw new Error("SCENE_IMAGE_GENERATION_ALREADY_SUCCEEDED");
  throw new Error("SCENE_IMAGE_FAILURE_CONFLICT");
}

/**
 * Cancels a not-yet-billed scene image generation and releases its reservation.
 * Only pending/queued generations with no active or billed provider request can
 * be cancelled; running provider calls are left to complete and reconcile so no
 * paid work is silently discarded.
 */
export async function cancelSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}): Promise<{ cancelled: boolean }> {
  const generation = await findSceneImageGeneration(input);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status === "cancelled") return { cancelled: false };
  if (
    generation.status === "succeeded" ||
    generation.status === "failed" ||
    generation.status === "running"
  )
    return { cancelled: false };

  const reservation = await findSceneImageReservation(input);
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
      from scene_image_generations generation
      inner join usage_reservations reservation
        on reservation.workspace_id = generation.workspace_id
        and reservation.project_id = generation.project_id
        and reservation.operation_type = 'scene_image_generation'
        and reservation.image_generation_id = generation.id
      where generation.workspace_id = ${input.workspaceId}
        and generation.project_id = ${input.projectId}
        and generation.id = ${input.generationId}
        and generation.status in ('pending', 'queued')
        and reservation.status = 'pending'
        and not exists (
          select 1
          from provider_requests provider_request
          where provider_request.workspace_id = generation.workspace_id
            and provider_request.project_id = generation.project_id
            and provider_request.generation_id = generation.id
            and (
              provider_request.status in ('pending', 'running', 'succeeded')
              or coalesce(provider_request.actual_cost_cents, 0) > 0
            )
        )
      for update of generation, reservation
    ),
    transitioned_generation as (
      update scene_image_generations generation
      set
        status = 'cancelled'::image_generation_status,
        actual_cost_cents = 0,
        progress_percent = 100,
        error_category = 'bulk_cancelled',
        safe_error_message = 'This generation was cancelled before it started.',
        completed_at = now(),
        updated_at = now()
      from eligible
      where generation.id = eligible.id
        and generation.status in ('pending', 'queued')
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
        and reservation.operation_type = 'scene_image_generation'
        and reservation.image_generation_id = transitioned_generation.id
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
        'scene_image_generation'::usage_operation_type,
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

export async function approveSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  userId: string;
}) {
  const generation = await findSceneImageGeneration(input);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status !== "succeeded")
    throw new Error("SCENE_IMAGE_GENERATION_NOT_SUCCESSFUL");
  if (generation.reviewStatus === "approved") return generation;
  const currentScene = await findApprovedCurrentSceneVersion({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneId: generation.sceneId,
    sceneVersionId: generation.sceneVersionId,
  });
  if (!currentScene) throw new Error("APPROVED_SCENE_VERSION_NOT_FOUND");

  const now = new Date();
  const [, approvedRows] = await getDatabase().batch([
    getDatabase()
      .update(sceneImageGenerations)
      .set({
        reviewStatus: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, input.workspaceId),
          eq(sceneImageGenerations.projectId, input.projectId),
          eq(sceneImageGenerations.sceneVersionId, generation.sceneVersionId),
          eq(sceneImageGenerations.reviewStatus, "approved"),
          ne(sceneImageGenerations.id, input.generationId),
        ),
      ),
    getDatabase()
      .update(sceneImageGenerations)
      .set({
        reviewStatus: "approved",
        reviewedByUserId: input.userId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, input.workspaceId),
          eq(sceneImageGenerations.projectId, input.projectId),
          eq(sceneImageGenerations.id, input.generationId),
          eq(sceneImageGenerations.sceneVersionId, generation.sceneVersionId),
          eq(sceneImageGenerations.status, "succeeded"),
        ),
      )
      .returning(),
  ]);
  const approved = approvedRows[0];
  if (!approved) throw new Error("SCENE_IMAGE_APPROVAL_CONFLICT");
  return approved;
}

export async function rejectSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  userId: string;
}) {
  const generation = await findSceneImageGeneration(input);
  if (!generation) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
  if (generation.status !== "succeeded")
    throw new Error("SCENE_IMAGE_GENERATION_NOT_SUCCESSFUL");
  if (generation.reviewStatus === "rejected") return generation;

  const [rejected] = await getDatabase()
    .update(sceneImageGenerations)
    .set({
      reviewStatus: "rejected",
      reviewedByUserId: input.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.id, input.generationId),
        eq(sceneImageGenerations.status, "succeeded"),
      ),
    )
    .returning();
  if (!rejected) throw new Error("SCENE_IMAGE_REJECTION_CONFLICT");
  return rejected;
}

export async function createStylePresetVersion(input: {
  workspaceId: string;
  stylePresetId: string;
  userId: string;
  expectedCurrentVersion?: number;
  name: string;
  description: string;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: ProjectAspectRatio;
}) {
  const [current] = await getDatabase()
    .select({ preset: stylePresets, version: stylePresetVersions })
    .from(stylePresets)
    .innerJoin(
      stylePresetVersions,
      and(
        eq(stylePresetVersions.workspaceId, input.workspaceId),
        eq(stylePresetVersions.stylePresetId, stylePresets.id),
      ),
    )
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
      ),
    )
    .orderBy(desc(stylePresetVersions.version))
    .limit(1);
  if (!current || current.preset.archivedAt)
    throw new Error("STYLE_PRESET_NOT_FOUND");
  if (
    input.expectedCurrentVersion !== undefined &&
    input.expectedCurrentVersion !== current.version.version
  )
    throw new Error("STYLE_PRESET_VERSION_CONFLICT");

  const nextVersion = current.version.version + 1;
  try {
    const [createdVersions] = await getDatabase().batch([
      getDatabase()
        .insert(stylePresetVersions)
        .values({
          workspaceId: input.workspaceId,
          stylePresetId: input.stylePresetId,
          version: nextVersion,
          name: input.name,
          description: input.description,
          positivePrompt: input.positivePrompt,
          negativePrompt: input.negativePrompt,
          defaultAspectRatio: input.defaultAspectRatio,
          createdByUserId: input.userId,
        })
        .returning(),
      getDatabase()
        .update(stylePresets)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(stylePresets.workspaceId, input.workspaceId),
            eq(stylePresets.id, input.stylePresetId),
          ),
        ),
    ]);
    const created = createdVersions[0];
    if (!created) throw new Error("STYLE_PRESET_VERSION_CREATE_FAILED");
    return created;
  } catch (error) {
    if (
      isUniqueConstraintError(
        error,
        "style_preset_versions_preset_version_unique",
      )
    )
      throw new Error("STYLE_PRESET_VERSION_CONFLICT");
    throw error;
  }
}
