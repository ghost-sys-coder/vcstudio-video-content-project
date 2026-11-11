import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  productionRunEvents,
  productionRunGateResults,
  productionRuns,
  type ProductionRun,
} from "@/db/schema";
import type { ProductionRunPolicy } from "@/lib/production-runs/production-run-policy";
import type { ProductionRunReferences } from "@/lib/production-runs/production-run-references";
import type {
  GateVerdict,
  ProductionRunEventKind,
  ProductionRunGateSubject,
  ProductionRunStage,
  ProductionRunStatus,
} from "@/lib/production-runs/production-run-state";

export class ProductionRunInFlightError extends Error {
  readonly code = "PRODUCTION_RUN_IN_FLIGHT";
  constructor() {
    super(
      "A production run is already open for this project. Cancel or resume it first.",
    );
    this.name = "ProductionRunInFlightError";
  }
}

function readErrorCode(error: unknown): string | null {
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (typeof candidate !== "object" || candidate === null) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const code = Reflect.get(candidate, "code");
    if (typeof code === "string") return code;
    pending.push(
      Reflect.get(candidate, "cause"),
      Reflect.get(candidate, "sourceError"),
    );
  }
  return null;
}

/**
 * Creates the run, or refuses because one is already open for the project.
 *
 * The refusal is the partial unique index, not the read the caller may have
 * done first: two starts a moment apart would both pass a read and both begin
 * spending. The index is what makes a second concurrent run impossible.
 */
export async function createProductionRun(input: {
  id: string;
  workspaceId: string;
  projectId: string;
  requestedByUserId: string;
  policy: ProductionRunPolicy;
  stage: ProductionRunStage;
}): Promise<ProductionRun> {
  try {
    const [created] = await getDatabase()
      .insert(productionRuns)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        requestedByUserId: input.requestedByUserId,
        policy: input.policy,
        stage: input.stage,
        status: "queued",
      })
      .returning();
    if (!created) throw new ProductionRunInFlightError();
    return created;
  } catch (error) {
    if (readErrorCode(error) === "23505")
      throw new ProductionRunInFlightError();
    throw error;
  }
}

export async function attachProductionRunTrigger(input: {
  workspaceId: string;
  runId: string;
  triggerRunId: string;
}): Promise<void> {
  await getDatabase()
    .update(productionRuns)
    .set({ triggerRunId: input.triggerRunId, updatedAt: new Date() })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
      ),
    );
}

/** Claims a queued or held run for the worker. Null means somebody else owns it. */
export async function claimProductionRunRunning(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRun | null> {
  const now = new Date();
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      status: "running",
      holdReason: null,
      startedAt: sql`coalesce(${productionRuns.startedAt}, ${now})`,
      updatedAt: now,
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        inArray(productionRuns.status, ["queued", "running"]),
      ),
    )
    .returning();
  return run ?? null;
}

/**
 * Moves the cursor. Every field is written together so a crash between two
 * writes cannot leave the stage advanced while its references lag behind.
 */
export async function updateProductionRunCursor(input: {
  workspaceId: string;
  runId: string;
  stage?: ProductionRunStage;
  attempts?: Partial<Record<ProductionRunStage, number>>;
  stageReferences?: ProductionRunReferences;
  spentCostCents?: number;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.attempts ? { attempts: input.attempts } : {}),
      ...(input.stageReferences
        ? { stageReferences: input.stageReferences }
        : {}),
      ...(input.spentCostCents !== undefined
        ? { spentCostCents: input.spentCostCents }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        eq(productionRuns.status, "running"),
      ),
    )
    .returning();
  return run ?? null;
}

/** Stops the run at its current stage for a person. Only a running run can hold. */
export async function holdProductionRun(input: {
  workspaceId: string;
  runId: string;
  reason: string;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({ status: "held", holdReason: input.reason, updatedAt: new Date() })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        eq(productionRuns.status, "running"),
      ),
    )
    .returning();
  return run ?? null;
}

/** A person picks a held run back up; it re-enters the queue. */
export async function resumeProductionRun(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      status: "queued",
      holdReason: null,
      triggerRunId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        eq(productionRuns.status, "held"),
      ),
    )
    .returning();
  return run ?? null;
}

export async function finishProductionRun(input: {
  workspaceId: string;
  runId: string;
  status: Extract<ProductionRunStatus, "ready_for_review" | "failed">;
  safeErrorMessage?: string | null;
  stageReferences?: ProductionRunReferences;
}): Promise<ProductionRun | null> {
  const now = new Date();
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      status: input.status,
      safeErrorMessage: input.safeErrorMessage ?? null,
      ...(input.stageReferences
        ? { stageReferences: input.stageReferences }
        : {}),
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        eq(productionRuns.status, "running"),
      ),
    )
    .returning();
  return run ?? null;
}

/** A person stops the run. Allowed while queued, running or held. */
export async function cancelProductionRun(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRun | null> {
  const now = new Date();
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      status: "cancelled",
      holdReason: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        inArray(productionRuns.status, ["queued", "running", "held"]),
      ),
    )
    .returning();
  return run ?? null;
}

/**
 * Marks a run failed from any non-terminal state. Used when the worker itself
 * crashed, where the ordinary running-only guard would strand the run.
 */
export async function failStoppedProductionRun(input: {
  workspaceId: string;
  runId: string;
  safeErrorMessage: string;
}): Promise<ProductionRun | null> {
  const now = new Date();
  const [run] = await getDatabase()
    .update(productionRuns)
    .set({
      status: "failed",
      safeErrorMessage: input.safeErrorMessage,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
        inArray(productionRuns.status, ["queued", "running"]),
      ),
    )
    .returning();
  return run ?? null;
}

export async function appendProductionRunEvent(input: {
  workspaceId: string;
  runId: string;
  stage: ProductionRunStage;
  kind: ProductionRunEventKind;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getDatabase()
    .insert(productionRunEvents)
    .values({
      workspaceId: input.workspaceId,
      runId: input.runId,
      stage: input.stage,
      kind: input.kind,
      message: input.message,
      metadata: input.metadata ?? {},
    });
}

export async function recordProductionRunGateResults(input: {
  workspaceId: string;
  runId: string;
  stage: ProductionRunStage;
  results: Array<{
    subject: ProductionRunGateSubject;
    subjectId: string;
    label: string;
    verdict: GateVerdict;
    score: number | null;
    reasons: string[];
    accepted: boolean;
  }>;
}): Promise<void> {
  if (input.results.length === 0) return;
  await getDatabase()
    .insert(productionRunGateResults)
    .values(
      input.results.map((result) => ({
        workspaceId: input.workspaceId,
        runId: input.runId,
        stage: input.stage,
        subject: result.subject,
        subjectId: result.subjectId,
        label: result.label,
        verdict: result.verdict,
        score: result.score,
        reasons: result.reasons,
        accepted: result.accepted,
      })),
    );
}
