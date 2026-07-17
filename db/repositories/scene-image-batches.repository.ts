import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneImageBatches, sceneImageGenerations } from "@/db/schema";
import {
  EMPTY_SCENE_IMAGE_BATCH_COUNTS,
  type SceneImageBatchCounts,
} from "@/lib/domain/bulk-scene-image";

export async function findSceneImageBatch(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
}) {
  const [batch] = await getDatabase()
    .select()
    .from(sceneImageBatches)
    .where(
      and(
        eq(sceneImageBatches.workspaceId, input.workspaceId),
        eq(sceneImageBatches.projectId, input.projectId),
        eq(sceneImageBatches.id, input.batchId),
      ),
    )
    .limit(1);
  return batch ?? null;
}

export async function findSceneImageBatchByRequestNonce(input: {
  workspaceId: string;
  requestNonce: string;
}) {
  const [batch] = await getDatabase()
    .select()
    .from(sceneImageBatches)
    .where(
      and(
        eq(sceneImageBatches.workspaceId, input.workspaceId),
        eq(sceneImageBatches.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return batch ?? null;
}

export async function findLatestSceneImageBatch(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [batch] = await getDatabase()
    .select()
    .from(sceneImageBatches)
    .where(
      and(
        eq(sceneImageBatches.workspaceId, input.workspaceId),
        eq(sceneImageBatches.projectId, input.projectId),
      ),
    )
    .orderBy(desc(sceneImageBatches.createdAt))
    .limit(1);
  return batch ?? null;
}

export async function listSceneImageGenerationsByBatch(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
}) {
  return getDatabase()
    .select({
      id: sceneImageGenerations.id,
      idempotencyKey: sceneImageGenerations.idempotencyKey,
      status: sceneImageGenerations.status,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.batchId, input.batchId),
      ),
    )
    .orderBy(sceneImageGenerations.createdAt)
    .limit(500);
}

export async function getSceneImageBatchAggregate(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
}): Promise<{
  counts: SceneImageBatchCounts;
  estimatedCostCents: number;
  actualCostCents: number;
}> {
  const [row] = await getDatabase()
    .select({
      total: sql<number>`cast(count(*) as int)`,
      pending: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'pending') as int)`,
      queued: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'queued') as int)`,
      running: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'running') as int)`,
      succeeded: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'succeeded') as int)`,
      failed: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'failed') as int)`,
      cancelled: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'cancelled') as int)`,
      estimatedCostCents: sql<number>`cast(coalesce(sum(${sceneImageGenerations.estimatedCostCents}), 0) as int)`,
      actualCostCents: sql<number>`cast(coalesce(sum(${sceneImageGenerations.actualCostCents}), 0) as int)`,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.batchId, input.batchId),
      ),
    );

  if (!row)
    return {
      counts: EMPTY_SCENE_IMAGE_BATCH_COUNTS,
      estimatedCostCents: 0,
      actualCostCents: 0,
    };

  return {
    counts: {
      total: Number(row.total),
      pending: Number(row.pending),
      queued: Number(row.queued),
      running: Number(row.running),
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
      cancelled: Number(row.cancelled),
    },
    estimatedCostCents: Number(row.estimatedCostCents),
    actualCostCents: Number(row.actualCostCents),
  };
}
