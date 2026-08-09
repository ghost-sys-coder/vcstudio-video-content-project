import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { findMarketingRunByIdempotencyKey } from "@/db/repositories/marketing-usage.repository";
import {
  marketingGenerationRuns,
  marketingUsageReservations,
  type MarketingOperation,
} from "@/db/schema";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import {
  getMarketingCommittedSpend,
  getWorkspaceCommittedSpend,
} from "@/lib/budgets/committed-spend";
import { MarketingBudgetExceededError } from "@/lib/domain/errors";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";

export type ReserveMarketingUsageInput = {
  workspaceId: string;
  operation: MarketingOperation;
  estimatedCostCents: number;
  idempotencyKey: string;
  requestedByUserId?: string | null;
  model?: string;
  promptVersion?: string;
  skillKey?: string;
  skillVersion?: number;
  brandContextFingerprint?: string;
  finalPrompt?: string;
  requestFingerprint?: string;
  subjectKind?: string;
  subjectId?: string | null;
  now?: Date;
};

export type ReserveMarketingUsageResult = {
  runId: string;
  reservationId: string;
  created: boolean;
};

function startOfDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The one money-safe entry point for marketing spend.
 *
 * Nothing may call a provider without a run and a reservation created here.
 * The sequence mirrors `createScriptGenerationReservation`: take a per-workspace
 * advisory lock, read committed spend **across both ledgers**, compare against
 * every applicable ceiling, and only then insert.
 *
 * The advisory lock is what makes the check-then-insert atomic against a
 * concurrent request for the same workspace. Without it two simultaneous
 * reservations each see the pre-spend total and both pass a limit that only one
 * of them fits under.
 */
export async function reserveMarketingUsage(
  input: ReserveMarketingUsageInput,
): Promise<ReserveMarketingUsageResult> {
  // Idempotency first: a replayed request must return the original run rather
  // than reserve a second time.
  const existing = await findMarketingRunByIdempotencyKey({
    workspaceId: input.workspaceId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing)
    return {
      runId: existing.run.id,
      reservationId: existing.reservationId,
      created: false,
    };

  const now = input.now ?? new Date();
  const [budget, settings] = await Promise.all([
    loadEffectiveWorkspaceBudget({ workspaceId: input.workspaceId }),
    loadMarketingSettings({ workspaceId: input.workspaceId }),
  ]);

  const expiresAt = new Date(
    now.getTime() +
      getSceneAnalysisEnvironment().GENERATION_RESERVATION_EXPIRY_MINUTES *
        60_000,
  );

  const database = getDatabase();

  // Serialise spending decisions for this workspace. `hashtextextended` matches
  // the key derivation already used by the script-generation reservation, so
  // the two ledgers contend on the same lock rather than racing each other.
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))`,
  );

  const [daily, monthly, marketingMonthly] = await Promise.all([
    getWorkspaceCommittedSpend({
      workspaceId: input.workspaceId,
      since: startOfDay(now),
    }),
    getWorkspaceCommittedSpend({
      workspaceId: input.workspaceId,
      since: startOfMonth(now),
    }),
    getMarketingCommittedSpend({
      workspaceId: input.workspaceId,
      since: startOfMonth(now),
    }),
  ]);

  if (daily.totalCents + input.estimatedCostCents > budget.dailyBudgetCents)
    throw new MarketingBudgetExceededError("workspace_daily");

  if (monthly.totalCents + input.estimatedCostCents > budget.monthlyBudgetCents)
    throw new MarketingBudgetExceededError("workspace_monthly");

  if (
    settings.monthlyMarketingBudgetCents !== null &&
    marketingMonthly + input.estimatedCostCents >
      settings.monthlyMarketingBudgetCents
  )
    throw new MarketingBudgetExceededError("marketing_monthly");

  const [run] = await database
    .insert(marketingGenerationRuns)
    .values({
      workspaceId: input.workspaceId,
      operation: input.operation,
      status: "pending",
      subjectKind: input.subjectKind ?? "",
      subjectId: input.subjectId ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      model: input.model ?? "",
      promptVersion: input.promptVersion ?? "",
      skillKey: input.skillKey ?? "",
      skillVersion: input.skillVersion ?? 1,
      brandContextFingerprint: input.brandContextFingerprint ?? "",
      finalPrompt: input.finalPrompt ?? "",
      requestFingerprint: input.requestFingerprint ?? "",
      idempotencyKey: input.idempotencyKey,
      estimatedCostCents: input.estimatedCostCents,
    })
    .returning();

  if (!run) throw new Error("MARKETING_RUN_NOT_CREATED");

  const [reservation] = await database
    .insert(marketingUsageReservations)
    .values({
      workspaceId: input.workspaceId,
      runId: run.id,
      operation: input.operation,
      status: "pending",
      reservedCostCents: input.estimatedCostCents,
      expiresAt,
    })
    .returning();

  if (!reservation) throw new Error("MARKETING_RESERVATION_NOT_CREATED");

  return { runId: run.id, reservationId: reservation.id, created: true };
}
