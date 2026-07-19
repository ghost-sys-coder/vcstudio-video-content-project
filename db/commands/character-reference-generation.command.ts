import "server-only";

import { and, eq, sql } from "drizzle-orm";
import {
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE,
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
  CHARACTER_REFERENCE_PROMPT_VERSION,
} from "@studio/prompts";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  characterReferenceGenerations,
  promptTemplateVersions,
  type CharacterReferenceGeneration,
  type CharacterReferenceType,
} from "@/db/schema";
import { findCharacterReferenceGeneration } from "@/db/repositories/character-reference-generation.repository";
import { singleCharacterReferenceTypes } from "@/lib/domain/character";
import { BudgetExceededError } from "@/lib/domain/errors";

export const CHARACTER_REFERENCE_PROMPT_TEMPLATE_KEY = "character-reference";

/**
 * Ensure the versioned character-reference prompt-template row exists. Runs
 * `INSERT ... ON CONFLICT DO NOTHING` so the feature works whether the schema
 * was applied via `db:migrate` (seed included) or `drizzle-kit push` (schema
 * only). The prompt-template immutability trigger permits inserts.
 */
export async function ensureCharacterReferencePromptTemplate(): Promise<void> {
  await getDatabase()
    .insert(promptTemplateVersions)
    .values({
      templateKey: CHARACTER_REFERENCE_PROMPT_TEMPLATE_KEY,
      version: CHARACTER_REFERENCE_PROMPT_VERSION,
      sourceHash: CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();
}

type ReservationInput = {
  generationId: string;
  workspaceId: string;
  characterId: string;
  referenceType: CharacterReferenceType;
  model: string;
  size: string;
  quality: string;
  outputFormat: string;
  outputCompression: number;
  background: string;
  finalPrompt: string;
  promptTemplateVersion: string;
  promptTemplateVersionId: string;
  requestNonce: string;
  idempotencyKey: string;
  requestFingerprint: string;
  estimatedCostCents: number;
  requestedByUserId: string;
  budget: {
    workspaceDailyLimitCents: number;
    workspaceMonthlyLimitCents: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
  };
};

/**
 * Create a queued portrait generation after an advisory-locked workspace-budget
 * check that includes both the money-safe ledger's committed spend and other
 * committed portrait generations. Idempotent on request nonce / idempotency key.
 */
export async function createCharacterReferenceGenerationReservation(
  input: ReservationInput,
): Promise<{ generation: CharacterReferenceGeneration; created: boolean }> {
  if (
    !Number.isInteger(input.estimatedCostCents) ||
    input.estimatedCostCents < 0
  )
    throw new Error("INVALID_CHARACTER_REFERENCE_ESTIMATED_COST");

  const existingByNonce = await getDatabase()
    .select()
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  if (existingByNonce[0])
    return { generation: existingByNonce[0], created: false };

  const result = await getDatabase().execute<{
    inserted_count: number;
    daily_cents: number;
    monthly_cents: number;
  }>(sql`
    with budget_lock as materialized (
      select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))
    ),
    reservation_committed as materialized (
      select
        coalesce(sum(case when ur.status = 'pending' then ur.reserved_cost_cents else coalesce(ur.actual_cost_cents, 0) end)
          filter (where ur.created_at >= ${input.budget.dailyWindowStart}), 0)::int as daily_cents,
        coalesce(sum(case when ur.status = 'pending' then ur.reserved_cost_cents else coalesce(ur.actual_cost_cents, 0) end)
          filter (where ur.created_at >= ${input.budget.monthlyWindowStart}), 0)::int as monthly_cents
      from budget_lock
      left join usage_reservations ur
        on ur.workspace_id = ${input.workspaceId}
        and ur.status in ('pending', 'reconciled')
    ),
    generation_committed as materialized (
      select
        coalesce(sum(case when crg.status in ('queued','running') then crg.estimated_cost_cents when crg.status = 'succeeded' then coalesce(crg.actual_cost_cents, 0) else 0 end)
          filter (where crg.created_at >= ${input.budget.dailyWindowStart}), 0)::int as daily_cents,
        coalesce(sum(case when crg.status in ('queued','running') then crg.estimated_cost_cents when crg.status = 'succeeded' then coalesce(crg.actual_cost_cents, 0) else 0 end)
          filter (where crg.created_at >= ${input.budget.monthlyWindowStart}), 0)::int as monthly_cents
      from character_reference_generations crg
      where crg.workspace_id = ${input.workspaceId}
    ),
    committed as materialized (
      select rc.daily_cents + gc.daily_cents as daily_cents,
             rc.monthly_cents + gc.monthly_cents as monthly_cents
      from reservation_committed rc cross join generation_committed gc
    ),
    inserted as (
      insert into character_reference_generations (
        id, workspace_id, character_id, reference_type, status, model, size, quality,
        output_format, output_compression, background, final_prompt,
        prompt_template_version, prompt_template_version_id, request_nonce,
        idempotency_key, request_fingerprint, estimated_cost_cents, requested_by_user_id
      )
      select ${input.generationId}, ${input.workspaceId}, ${input.characterId},
        ${input.referenceType}::character_reference_type,
        'queued'::character_reference_generation_status,
        ${input.model}, ${input.size}, ${input.quality}, ${input.outputFormat},
        ${input.outputCompression}, ${input.background}, ${input.finalPrompt},
        ${input.promptTemplateVersion}, ${input.promptTemplateVersionId}, ${input.requestNonce},
        ${input.idempotencyKey}, ${input.requestFingerprint}, ${input.estimatedCostCents},
        ${input.requestedByUserId}
      from committed c
      where c.daily_cents + ${input.estimatedCostCents} <= ${input.budget.workspaceDailyLimitCents}
        and c.monthly_cents + ${input.estimatedCostCents} <= ${input.budget.workspaceMonthlyLimitCents}
      returning id
    )
    select (select count(*) from inserted)::int as inserted_count,
           c.daily_cents, c.monthly_cents
    from committed c
  `);

  const row = result.rows[0];
  if (!row) throw new Error("CHARACTER_REFERENCE_RESERVATION_FAILED");
  if (Number(row.inserted_count) === 0) {
    const scope =
      Number(row.daily_cents) + input.estimatedCostCents >
      input.budget.workspaceDailyLimitCents
        ? "workspace_daily"
        : "workspace_monthly";
    throw new BudgetExceededError(scope);
  }

  const generation = await findCharacterReferenceGeneration({
    workspaceId: input.workspaceId,
    generationId: input.generationId,
  });
  if (!generation) throw new Error("CHARACTER_REFERENCE_RESERVATION_MISSING");
  return { generation, created: true };
}

export async function attachCharacterReferenceTriggerRun(input: {
  workspaceId: string;
  generationId: string;
  triggerRunId: string;
}): Promise<void> {
  await getDatabase()
    .update(characterReferenceGenerations)
    .set({ triggerRunId: input.triggerRunId, updatedAt: new Date() })
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
      ),
    );
}

export async function claimCharacterReferenceGenerationRunning(input: {
  workspaceId: string;
  generationId: string;
  providerRequestId: string;
  attemptNumber: number;
}): Promise<{ claimed: boolean; generation: CharacterReferenceGeneration }> {
  const now = new Date();
  const [updated] = await getDatabase()
    .update(characterReferenceGenerations)
    .set({
      status: "running",
      attemptCount: input.attemptNumber,
      providerRequestId: input.providerRequestId,
      progressPercent: 10,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
        eq(characterReferenceGenerations.status, "queued"),
      ),
    )
    .returning();
  if (updated) return { claimed: true, generation: updated };
  const existing = await findCharacterReferenceGeneration({
    workspaceId: input.workspaceId,
    generationId: input.generationId,
  });
  if (!existing) throw new Error("CHARACTER_REFERENCE_GENERATION_NOT_FOUND");
  return { claimed: false, generation: existing };
}

export async function updateCharacterReferenceGenerationProgress(input: {
  workspaceId: string;
  generationId: string;
  progressPercent: number;
}): Promise<void> {
  await getDatabase()
    .update(characterReferenceGenerations)
    .set({ progressPercent: input.progressPercent, updatedAt: new Date() })
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
      ),
    );
}

/**
 * Persist the generated portrait as a `generated` character reference asset
 * (replacing an existing single-view asset of the same type) and mark the
 * generation succeeded with its actual cost. Returns the replaced asset (if
 * any) so its stored object can be cleaned up.
 */
export async function completeCharacterReferenceGeneration(input: {
  workspaceId: string;
  characterId: string;
  generationId: string;
  referenceType: CharacterReferenceType;
  actualCostCents: number;
  asset: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
    etag: string | null;
  };
  createdByUserId: string;
}): Promise<{
  referenceId: string;
  previous: typeof characterReferenceAssets.$inferSelect | null;
}> {
  const referenceId = crypto.randomUUID();
  const now = new Date();
  let previous: typeof characterReferenceAssets.$inferSelect | null = null;
  if (singleCharacterReferenceTypes.has(input.referenceType)) {
    const [existing] = await getDatabase()
      .select()
      .from(characterReferenceAssets)
      .where(
        and(
          eq(characterReferenceAssets.workspaceId, input.workspaceId),
          eq(characterReferenceAssets.characterId, input.characterId),
          eq(characterReferenceAssets.type, input.referenceType),
        ),
      )
      .limit(1);
    previous = existing ?? null;
  }

  const insertAsset = getDatabase().insert(characterReferenceAssets).values({
    id: referenceId,
    workspaceId: input.workspaceId,
    characterId: input.characterId,
    type: input.referenceType,
    source: "generated",
    objectKey: input.asset.objectKey,
    contentType: input.asset.contentType,
    sizeBytes: input.asset.sizeBytes,
    width: input.asset.width,
    height: input.asset.height,
    etag: input.asset.etag,
    createdByUserId: input.createdByUserId,
  });
  const markSucceeded = getDatabase()
    .update(characterReferenceGenerations)
    .set({
      status: "succeeded",
      actualCostCents: input.actualCostCents,
      resultReferenceAssetId: referenceId,
      progressPercent: 100,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
      ),
    );

  if (previous) {
    await getDatabase().batch([
      getDatabase()
        .delete(characterReferenceAssets)
        .where(eq(characterReferenceAssets.id, previous.id)),
      insertAsset,
      markSucceeded,
    ]);
  } else {
    await getDatabase().batch([insertAsset, markSucceeded]);
  }
  return { referenceId, previous };
}

export async function failCharacterReferenceGeneration(input: {
  workspaceId: string;
  generationId: string;
  safeErrorMessage: string;
  actualCostCents?: number;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(characterReferenceGenerations)
    .set({
      status: "failed",
      safeErrorMessage: input.safeErrorMessage,
      actualCostCents: input.actualCostCents ?? 0,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
      ),
    );
}
