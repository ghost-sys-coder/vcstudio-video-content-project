import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { usageReservations } from "@/db/schema";
import {
  mcpOperations,
  sceneImageGenerations,
  sceneAudioGenerations,
} from "@/db/schema";
import type { McpContext } from "@/lib/mcp/context";

/** Consume a quote once, while locking its saved authority to the reviewed revision. */
export async function consumeMcpGeneration(
  context: McpContext,
  operationId: string,
  proofHash?: string,
) {
  const [row] = await getDatabase()
    .update(mcpOperations)
    .set({
      status: "approved",
      approvalHash: null,
      expiresAt: new Date(Date.now() + 2 * 3600_000),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mcpOperations.id, operationId),
        eq(mcpOperations.workspaceId, context.workspaceId),
        eq(mcpOperations.connectionId, context.connection.id),
        eq(mcpOperations.userId, context.principal.userId),
        eq(mcpOperations.kind, "generate_media"),
        eq(mcpOperations.status, proofHash ? "requires_approval" : "prepared"),
        proofHash ? eq(mcpOperations.approvalHash, proofHash) : undefined,
        sql`${mcpOperations.expiresAt} > now()`,
        sql`exists(select 1 from mcp_connections c where c.id=${mcpOperations.connectionId} and c.revoked_at is null and date_trunc('milliseconds',c.updated_at)=${context.connection.updatedAt.toISOString()}::timestamptz)`,
        sql`exists(select 1 from mcp_workspace_grants g join workspace_members m on m.workspace_id=g.workspace_id and m.user_id=${context.principal.userId}::uuid where g.connection_id=${mcpOperations.connectionId} and g.workspace_id=${mcpOperations.workspaceId} and date_trunc('milliseconds',g.updated_at)=${context.grant.updatedAt.toISOString()}::timestamptz and g.scopes @> '["vcstudio:generate"]'::jsonb and m.role in ('owner','editor') and (${!!proofHash}::boolean or (g.generation_approval_mode='autonomous' and m.role='owner')))`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function listMcpGenerationJobs(
  workspaceId: string,
  operationId: string,
) {
  const [images, audio] = await Promise.all([
    getDatabase()
      .select({
        id: sceneImageGenerations.id,
        projectId: sceneImageGenerations.projectId,
        sceneId: sceneImageGenerations.sceneId,
        status: sceneImageGenerations.status,
        reviewStatus: sceneImageGenerations.reviewStatus,
        error: sceneImageGenerations.safeErrorMessage,
        actualCostCents: sceneImageGenerations.actualCostCents,
        triggerRunId: sceneImageGenerations.triggerRunId,
      })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, workspaceId),
          eq(sceneImageGenerations.mcpOperationId, operationId),
        ),
      )
      .limit(1),
    getDatabase()
      .select({
        id: sceneAudioGenerations.id,
        projectId: sceneAudioGenerations.projectId,
        sceneId: sceneAudioGenerations.sceneId,
        status: sceneAudioGenerations.status,
        reviewStatus: sceneAudioGenerations.reviewStatus,
        error: sceneAudioGenerations.safeErrorMessage,
        actualCostCents: sceneAudioGenerations.actualCostCents,
        triggerRunId: sceneAudioGenerations.triggerRunId,
      })
      .from(sceneAudioGenerations)
      .where(
        and(
          eq(sceneAudioGenerations.workspaceId, workspaceId),
          eq(sceneAudioGenerations.mcpOperationId, operationId),
        ),
      )
      .limit(1),
  ]);
  return [
    ...images.map((job) => ({ ...job, kind: "scene_image" as const })),
    ...audio.map((job) => ({ ...job, kind: "scene_audio" as const })),
  ];
}

export async function claimMcpStandaloneGeneration(
  workspaceId: string,
  operationId: string,
) {
  const [row] = await getDatabase()
    .update(mcpOperations)
    .set({
      status: "running",
      result: { attemptCount: 1, startedAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mcpOperations.id, operationId),
        eq(mcpOperations.workspaceId, workspaceId),
        eq(mcpOperations.kind, "generate_media"),
        inArray(mcpOperations.status, ["approved", "queued"]),
        sql`${mcpOperations.expiresAt}>now()`,
        sql`exists(select 1 from usage_reservations r where r.media_generation_operation_id=${mcpOperations.id} and r.workspace_id=${mcpOperations.workspaceId} and r.status='pending' and r.expires_at>now())`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function listMcpGenerationRecoveryOperations() {
  return getDatabase()
    .select({
      operation: mcpOperations,
      reservedCostCents: usageReservations.reservedCostCents,
      reservationStatus: usageReservations.status,
    })
    .from(mcpOperations)
    .leftJoin(
      usageReservations,
      and(
        eq(usageReservations.workspaceId, mcpOperations.workspaceId),
        eq(usageReservations.mediaGenerationOperationId, mcpOperations.id),
      ),
    )
    .where(
      and(
        eq(mcpOperations.kind, "generate_media"),
        sql`(${mcpOperations.updatedAt}<now()-interval '30 minutes' or ${mcpOperations.expiresAt}<=now())`,
        sql`(${usageReservations.status}='pending' or ${mcpOperations.status} in ('approved','queued','running'))`,
      ),
    )
    .orderBy(mcpOperations.updatedAt)
    .limit(25);
}

export async function listMcpSceneAudio(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  return getDatabase()
    .select({
      id: sceneAudioGenerations.id,
      status: sceneAudioGenerations.status,
      reviewStatus: sceneAudioGenerations.reviewStatus,
      format: sceneAudioGenerations.format,
      durationMilliseconds: sceneAudioGenerations.durationMilliseconds,
      error: sceneAudioGenerations.safeErrorMessage,
      provider: sceneAudioGenerations.provider,
      model: sceneAudioGenerations.model,
    })
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.sceneVersionId, input.sceneVersionId),
      ),
    )
    .orderBy(sql`${sceneAudioGenerations.createdAt} desc`)
    .limit(24);
}
