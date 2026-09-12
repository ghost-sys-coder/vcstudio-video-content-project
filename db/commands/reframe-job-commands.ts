import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projectReframeJobs } from "@/db/schema";
import { ACTIVE_REFRAME_STATUSES } from "@/db/repositories/reframe-jobs.repository";

export class ReframeJobInFlightError extends Error {
  constructor() {
    super("A reframe is already running for this shape.");
    this.name = "ReframeJobInFlightError";
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
 * Starts a job, or refuses because one is already running for this shape.
 *
 * The refusal is enforced by `project_reframe_jobs_active_unique` rather than
 * by the check above it: two clicks a moment apart would both pass a read and
 * both spend. The read exists only to give a friendly answer in the ordinary
 * case; the index is what actually makes double spending impossible.
 */
export async function createReframeJob(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  requestedByUserId: string;
  sceneCount: number;
  extendCount: number;
  cropCount: number;
  readyCount: number;
  estimatedCostCents: number;
  extendGenerationIds: string[];
  croppedSceneNumbers: number[];
  status: "extending" | "rendering";
}) {
  try {
    const [created] = await getDatabase()
      .insert(projectReframeJobs)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        outputVariantId: input.outputVariantId,
        requestedByUserId: input.requestedByUserId,
        status: input.status,
        sceneCount: input.sceneCount,
        extendCount: input.extendCount,
        cropCount: input.cropCount,
        readyCount: input.readyCount,
        estimatedCostCents: input.estimatedCostCents,
        extendGenerationIds: input.extendGenerationIds,
        croppedSceneNumbers: input.croppedSceneNumbers,
      })
      .returning();
    if (!created) throw new ReframeJobInFlightError();
    return created;
  } catch (error) {
    if (readErrorCode(error) === "23505") throw new ReframeJobInFlightError();
    throw error;
  }
}

export async function attachReframeJobRun(input: {
  workspaceId: string;
  jobId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(projectReframeJobs)
    .set({ triggerRunId: input.triggerRunId, updatedAt: new Date() })
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.id, input.jobId),
      ),
    );
}

/**
 * Moves a job from extending to rendering.
 *
 * Scoped to the `extending` state so a retry, or a duplicate run, cannot start
 * a second render for the same job. The caller treats "no row updated" as
 * "somebody else already advanced it" rather than as a failure.
 */
export async function markReframeJobRendering(input: {
  workspaceId: string;
  jobId: string;
  renderId: string;
  croppedSceneNumbers: number[];
}) {
  const [updated] = await getDatabase()
    .update(projectReframeJobs)
    .set({
      status: "rendering",
      renderId: input.renderId,
      croppedSceneNumbers: input.croppedSceneNumbers,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.id, input.jobId),
        eq(projectReframeJobs.status, "extending"),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function markReframeJobCompleted(input: {
  workspaceId: string;
  jobId: string;
}) {
  const [updated] = await getDatabase()
    .update(projectReframeJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.id, input.jobId),
        inArray(projectReframeJobs.status, [...ACTIVE_REFRAME_STATUSES]),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function markReframeJobFailed(input: {
  workspaceId: string;
  jobId: string;
  safeErrorMessage: string;
}) {
  const [updated] = await getDatabase()
    .update(projectReframeJobs)
    .set({
      status: "failed",
      safeErrorMessage: input.safeErrorMessage,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.id, input.jobId),
        inArray(projectReframeJobs.status, [...ACTIVE_REFRAME_STATUSES]),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function cancelReframeJob(input: {
  workspaceId: string;
  projectId: string;
  jobId: string;
}) {
  const [updated] = await getDatabase()
    .update(projectReframeJobs)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.projectId, input.projectId),
        eq(projectReframeJobs.id, input.jobId),
        inArray(projectReframeJobs.status, [...ACTIVE_REFRAME_STATUSES]),
      ),
    )
    .returning();
  return updated ?? null;
}
