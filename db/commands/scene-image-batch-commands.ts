import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneImageBatches, sceneImageGenerations } from "@/db/schema";
import { cancelSceneImageGeneration } from "@/db/commands/scene-image-commands";
import {
  findSceneImageBatch,
  findSceneImageBatchByRequestNonce,
} from "@/db/repositories/scene-image-batches.repository";

type ImageQuality = typeof sceneImageBatches.$inferInsert.quality;

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

export async function createSceneImageBatch(input: {
  batchId: string;
  workspaceId: string;
  projectId: string;
  requestNonce: string;
  stylePresetVersionId: string;
  quality: ImageQuality;
  size: string;
  requestedSceneCount: number;
  estimatedCostCents: number;
  requestedByUserId: string;
}): Promise<{
  batch: typeof sceneImageBatches.$inferSelect;
  created: boolean;
}> {
  if (
    !Number.isInteger(input.requestedSceneCount) ||
    input.requestedSceneCount < 1
  )
    throw new Error("INVALID_SCENE_IMAGE_BATCH_SCENE_COUNT");
  if (
    !Number.isInteger(input.estimatedCostCents) ||
    input.estimatedCostCents < 0
  )
    throw new Error("INVALID_SCENE_IMAGE_BATCH_ESTIMATED_COST");

  try {
    const [created] = await getDatabase()
      .insert(sceneImageBatches)
      .values({
        id: input.batchId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        requestNonce: input.requestNonce,
        stylePresetVersionId: input.stylePresetVersionId,
        quality: input.quality,
        size: input.size,
        requestedSceneCount: input.requestedSceneCount,
        estimatedCostCents: input.estimatedCostCents,
        requestedByUserId: input.requestedByUserId,
      })
      .returning();
    if (!created) throw new Error("SCENE_IMAGE_BATCH_CREATE_FAILED");
    return { batch: created, created: true };
  } catch (error) {
    if (
      isUniqueConstraintError(
        error,
        "scene_image_batches_workspace_request_nonce_unique",
      )
    ) {
      const existing = await findSceneImageBatchByRequestNonce({
        workspaceId: input.workspaceId,
        requestNonce: input.requestNonce,
      });
      if (existing && existing.projectId === input.projectId)
        return { batch: existing, created: false };
    }
    throw error;
  }
}

export async function markSceneImageBatchDispatched(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
  reservedSceneCount: number;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(sceneImageBatches)
    .set({
      status: "processing",
      reservedSceneCount: input.reservedSceneCount,
      dispatchedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(sceneImageBatches.workspaceId, input.workspaceId),
        eq(sceneImageBatches.projectId, input.projectId),
        eq(sceneImageBatches.id, input.batchId),
        eq(sceneImageBatches.status, "pending"),
      ),
    );
}

/**
 * Cancels a batch and every not-yet-billed child generation it still owns.
 * Running or completed generations are left untouched so paid work is never
 * discarded; their reservations reconcile through the normal flow.
 */
export async function cancelSceneImageBatch(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
}): Promise<{ cancelledGenerationCount: number }> {
  const batch = await findSceneImageBatch(input);
  if (!batch) throw new Error("SCENE_IMAGE_BATCH_NOT_FOUND");

  const cancellableGenerations = await getDatabase()
    .select({ id: sceneImageGenerations.id })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.batchId, input.batchId),
        inArray(sceneImageGenerations.status, ["pending", "queued"]),
      ),
    );

  let cancelledGenerationCount = 0;
  for (const generation of cancellableGenerations) {
    const result = await cancelSceneImageGeneration({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: generation.id,
    });
    if (result.cancelled) cancelledGenerationCount += 1;
  }

  const now = new Date();
  await getDatabase()
    .update(sceneImageBatches)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(
      and(
        eq(sceneImageBatches.workspaceId, input.workspaceId),
        eq(sceneImageBatches.projectId, input.projectId),
        eq(sceneImageBatches.id, input.batchId),
        inArray(sceneImageBatches.status, ["pending", "processing"]),
      ),
    );

  return { cancelledGenerationCount };
}
