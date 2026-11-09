import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets } from "@/db/schema";
import {
  mcpConnections,
  mcpWorkspaceGrants,
  mcpOperations,
  mcpAssetOrigins,
} from "@/db/schema";
import type {
  McpOperationStatus,
  McpScope,
  McpPublicationApprovalMode,
} from "@studio/contracts";

export type McpOperation = typeof mcpOperations.$inferSelect;
export async function ensureMcpConnection(userId: string, clientId: string) {
  await getDatabase()
    .insert(mcpConnections)
    .values({ userId, clientId })
    .onConflictDoNothing();
  const [row] = await getDatabase()
    .select()
    .from(mcpConnections)
    .where(
      and(
        eq(mcpConnections.userId, userId),
        eq(mcpConnections.clientId, clientId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("MCP_CONNECTION_MISSING");
  return row;
}
export async function findMcpConnection(id: string, userId: string) {
  const [row] = await getDatabase()
    .select()
    .from(mcpConnections)
    .where(and(eq(mcpConnections.id, id), eq(mcpConnections.userId, userId)))
    .limit(1);
  return row ?? null;
}
export async function listMcpConnections(userId: string) {
  return getDatabase()
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.userId, userId))
    .orderBy(desc(mcpConnections.updatedAt))
    .limit(50);
}
export async function listMcpGrants(connectionId: string) {
  return getDatabase()
    .select()
    .from(mcpWorkspaceGrants)
    .where(eq(mcpWorkspaceGrants.connectionId, connectionId))
    .limit(50);
}
export async function findMcpGrant(connectionId: string, workspaceId: string) {
  const [row] = await getDatabase()
    .select()
    .from(mcpWorkspaceGrants)
    .where(
      and(
        eq(mcpWorkspaceGrants.connectionId, connectionId),
        eq(mcpWorkspaceGrants.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function saveMcpGrant(input: {
  connectionId: string;
  userId: string;
  workspaceId: string;
  scopes: McpScope[];
  publicationApprovalMode: McpPublicationApprovalMode;
}) {
  // Reconnection is an explicit signed-in action, never an effect of seeing a token.
  const owned = await findMcpConnection(input.connectionId, input.userId);
  if (!owned) throw new Error("MCP_CONNECTION_NOT_OWNED");
  await getDatabase().batch([
    getDatabase()
      .insert(mcpWorkspaceGrants)
      .values(input)
      .onConflictDoUpdate({
        target: [
          mcpWorkspaceGrants.connectionId,
          mcpWorkspaceGrants.workspaceId,
        ],
        set: {
          scopes: input.scopes,
          publicationApprovalMode: input.publicationApprovalMode,
          updatedAt: new Date(),
        },
      }),
    getDatabase()
      .update(mcpConnections)
      .set({ revokedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(mcpConnections.id, input.connectionId),
          eq(mcpConnections.userId, input.userId),
        ),
      ),
  ]);
}
export async function revokeMcpConnection(
  connectionId: string,
  userId: string,
) {
  const condition = and(
    eq(mcpConnections.id, connectionId),
    eq(mcpConnections.userId, userId),
  );
  await getDatabase().batch([
    getDatabase()
      .update(mcpConnections)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(condition),
    getDatabase()
      .update(mcpOperations)
      .set({
        status: "cancelled",
        approvalHash: null,
        sealedSource: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mcpOperations.connectionId, connectionId),
          eq(mcpOperations.userId, userId),
          inArray(mcpOperations.status, [
            "requires_approval",
            "prepared",
            "awaiting_upload",
            "queued",
          ]),
        ),
      ),
  ]);
}
export async function beginMcpOperation(
  input: typeof mcpOperations.$inferInsert,
) {
  const [created] = await getDatabase()
    .insert(mcpOperations)
    .values(input)
    .onConflictDoNothing()
    .returning();
  if (created) return { created: true, operation: created };
  const [operation] = await getDatabase()
    .select()
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.connectionId, input.connectionId),
        eq(mcpOperations.workspaceId, input.workspaceId),
        eq(mcpOperations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (!operation) throw new Error("MCP_OPERATION_MISSING");
  return { created: false, operation };
}
export async function findMcpOperation(input: {
  operationId: string;
  workspaceId: string;
  userId?: string;
  connectionId?: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.id, input.operationId),
        eq(mcpOperations.workspaceId, input.workspaceId),
        input.userId ? eq(mcpOperations.userId, input.userId) : undefined,
        input.connectionId
          ? eq(mcpOperations.connectionId, input.connectionId)
          : undefined,
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function findMcpOperationByKey(
  connectionId: string,
  workspaceId: string,
  idempotencyKey: string,
) {
  const [row] = await getDatabase()
    .select()
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.connectionId, connectionId),
        eq(mcpOperations.workspaceId, workspaceId),
        eq(mcpOperations.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function updateMcpOperation(input: {
  operationId: string;
  workspaceId: string;
  from?: McpOperationStatus[];
  values: Partial<
    Pick<
      McpOperation,
      | "status"
      | "result"
      | "error"
      | "sealedSource"
      | "approvalHash"
      | "triggerRunId"
    >
  >;
}) {
  const [row] = await getDatabase()
    .update(mcpOperations)
    .set({ ...input.values, updatedAt: new Date() })
    .where(
      and(
        eq(mcpOperations.id, input.operationId),
        eq(mcpOperations.workspaceId, input.workspaceId),
        input.from ? inArray(mcpOperations.status, input.from) : undefined,
      ),
    )
    .returning();
  return row ?? null;
}
export async function consumeMcpApproval(input: {
  operationId: string;
  workspaceId: string;
  connectionId: string;
  userId: string;
  approvalHash?: string;
}) {
  const [row] = await getDatabase()
    .update(mcpOperations)
    .set({ status: "approved", approvalHash: null, updatedAt: new Date() })
    .where(
      and(
        eq(mcpOperations.id, input.operationId),
        eq(mcpOperations.workspaceId, input.workspaceId),
        eq(mcpOperations.connectionId, input.connectionId),
        eq(mcpOperations.userId, input.userId),
        eq(mcpOperations.status, "requires_approval"),
        sql`${mcpOperations.expiresAt} > now()`,
        input.approvalHash
          ? eq(mcpOperations.approvalHash, input.approvalHash)
          : undefined,
        sql`exists (select 1 from mcp_connections c where c.id = ${mcpOperations.connectionId} and c.revoked_at is null)`,
        sql`exists (select 1 from workspace_members m where m.workspace_id = ${mcpOperations.workspaceId} and m.user_id = ${mcpOperations.userId} and m.role in ('owner', 'editor'))`,
        sql`exists (select 1 from mcp_workspace_grants g where g.connection_id = ${mcpOperations.connectionId} and g.workspace_id = ${mcpOperations.workspaceId} and g.scopes @> '["vcstudio:publish"]'::jsonb)`,
      ),
    )
    .returning();
  return row ?? null;
}
export async function consumeMcpAutonomousPublication(input: {
  operationId: string;
  workspaceId: string;
  connectionId: string;
  userId: string;
  grantUpdatedAt: Date;
  connectionUpdatedAt: Date;
}) {
  const [row] = await getDatabase()
    .update(mcpOperations)
    .set({ status: "approved", approvalHash: null, updatedAt: new Date() })
    .where(
      and(
        eq(mcpOperations.id, input.operationId),
        eq(mcpOperations.workspaceId, input.workspaceId),
        eq(mcpOperations.connectionId, input.connectionId),
        eq(mcpOperations.userId, input.userId),
        eq(mcpOperations.kind, "publish_post"),
        eq(mcpOperations.status, "prepared"),
        sql`${mcpOperations.expiresAt} > now()`,
        sql`${mcpOperations.input}->>'approvalMode' = 'autonomous'`,
        sql`exists (select 1 from mcp_connections c where c.id = ${mcpOperations.connectionId} and c.revoked_at is null and c.updated_at = ${input.connectionUpdatedAt.toISOString()}::timestamptz)`,
        sql`exists (select 1 from workspace_members m where m.workspace_id = ${mcpOperations.workspaceId} and m.user_id = ${mcpOperations.userId} and m.role = 'owner')`,
        sql`exists (select 1 from mcp_workspace_grants g where g.connection_id = ${mcpOperations.connectionId} and g.workspace_id = ${mcpOperations.workspaceId} and g.publication_approval_mode = 'autonomous' and g.updated_at = ${input.grantUpdatedAt.toISOString()}::timestamptz and g.scopes @> '["vcstudio:publish"]'::jsonb)`,
      ),
    )
    .returning();
  return row ?? null;
}
export async function listMcpActivity(
  userId: string,
  workspaceId: string,
  limit = 25,
) {
  return getDatabase()
    .select({
      id: mcpOperations.id,
      kind: mcpOperations.kind,
      status: mcpOperations.status,
      error: mcpOperations.error,
      createdAt: mcpOperations.createdAt,
    })
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.userId, userId),
        eq(mcpOperations.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(mcpOperations.createdAt))
    .limit(Math.min(limit, 50));
}
export async function addMcpAssetOrigin(
  input: typeof mcpAssetOrigins.$inferInsert,
) {
  await getDatabase()
    .insert(mcpAssetOrigins)
    .values(input)
    .onConflictDoNothing();
}
export async function listMcpRecoveryOperations() {
  return getDatabase()
    .select()
    .from(mcpOperations)
    .where(
      and(
        inArray(mcpOperations.status, [
          "approved",
          "queued",
          "awaiting_upload",
          "requires_approval",
          "running",
        ]),
        lt(mcpOperations.updatedAt, new Date(Date.now() - 30 * 60_000)),
      ),
    )
    .orderBy(mcpOperations.updatedAt)
    .limit(25);
}
export async function revokeExpiredMcpSecrets() {
  await getDatabase()
    .update(mcpOperations)
    .set({
      status: "expired",
      sealedSource: null,
      approvalHash: null,
      error:
        "This request expired. Start a new request with a fresh file or preview.",
      updatedAt: new Date(),
    })
    .where(
      and(
        lt(mcpOperations.expiresAt, new Date()),
        inArray(mcpOperations.status, [
          "requires_approval",
          "prepared",
          "awaiting_upload",
          "queued",
        ]),
      ),
    );
}

export async function setMcpPendingAssetSize(
  workspaceId: string,
  mediaAssetId: string,
  sizeBytes: number,
) {
  await getDatabase()
    .update(mediaAssets)
    .set({ sizeBytes, updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.workspaceId, workspaceId),
        eq(mediaAssets.id, mediaAssetId),
        eq(mediaAssets.status, "pending"),
      ),
    );
}

export async function setMcpPendingAssetObject(
  workspaceId: string,
  mediaAssetId: string,
  objectKey: string,
) {
  const [row] = await getDatabase()
    .update(mediaAssets)
    .set({ objectKey, updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.workspaceId, workspaceId),
        eq(mediaAssets.id, mediaAssetId),
        eq(mediaAssets.status, "pending"),
      ),
    )
    .returning();
  return row ?? null;
}
export async function listMcpAbandonedImports(limit: number) {
  return getDatabase()
    .select({ asset: mediaAssets, operationId: mcpOperations.id })
    .from(mcpOperations)
    .innerJoin(
      mediaAssets,
      and(
        eq(mediaAssets.workspaceId, mcpOperations.workspaceId),
        eq(mediaAssets.id, mcpOperations.id),
      ),
    )
    .where(
      and(
        eq(mcpOperations.kind, "import_asset"),
        inArray(mcpOperations.status, ["failed", "cancelled", "expired"]),
        inArray(mediaAssets.status, ["pending", "failed"]),
        sql`${mcpOperations.result}->>'storageCleaned' is distinct from 'true'`,
      ),
    )
    .orderBy(mcpOperations.createdAt)
    .limit(Math.min(limit, 25));
}

export async function listMcpUploadChunkCleanup() {
  return getDatabase()
    .select()
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.kind, "import_asset"),
        sql`${mcpOperations.input}->>'sourceKind' = 'mcp_upload'`,
        inArray(mcpOperations.status, [
          "failed",
          "cancelled",
          "expired",
          "succeeded",
        ]),
        sql`${mcpOperations.result}->>'uploadChunksCleaned' is distinct from 'true'`,
        lt(mcpOperations.updatedAt, new Date(Date.now() - 10 * 60_000)),
      ),
    )
    .orderBy(mcpOperations.updatedAt)
    .limit(25);
}
export async function markMcpUploadChunksCleaned(
  workspaceId: string,
  operationId: string,
) {
  await getDatabase()
    .update(mcpOperations)
    .set({
      result: sql`coalesce(${mcpOperations.result},'{}'::jsonb) || '{"uploadChunksCleaned":true}'::jsonb`,
    })
    .where(
      and(
        eq(mcpOperations.id, operationId),
        eq(mcpOperations.workspaceId, workspaceId),
        sql`${mcpOperations.input}->>'sourceKind' = 'mcp_upload'`,
        inArray(mcpOperations.status, [
          "failed",
          "cancelled",
          "expired",
          "succeeded",
        ]),
      ),
    );
}

export async function releaseAbandonedMcpPostLocks() {
  await getDatabase().execute(sql`
    update social_posts p set mcp_operation_id = null
    from mcp_operations o where p.mcp_operation_id = o.id
      and p.workspace_id = o.workspace_id
      and (o.status in ('cancelled', 'expired', 'failed', 'succeeded')
        or (o.status = 'requires_approval' and o.expires_at <= now()))
  `);
}
