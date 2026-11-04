import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mcpOperations } from "@/db/schema";
import type { beginMcpOperation } from "@/db/repositories/mcp.repository";

/** Save chosen draft accounts and their exact approval preview in one commit. */
export async function beginMcpPublicationWithDestinations(
  input: Parameters<typeof beginMcpOperation>[0] & {
    postId: string;
    expectedVersion: number;
    connectionIds: string[];
  },
) {
  const database = getDatabase();
  const operationId = randomUUID();
  const result = await database.execute<{ id: string }>(sql`
    with claimed as (
      update social_posts set version = version + 1, updated_at = now()
      where id = ${input.postId}::uuid and workspace_id = ${input.workspaceId}::uuid
        and version = ${input.expectedVersion} and mcp_operation_id is null
        and status in ('draft', 'scheduled', 'failed', 'partially_failed')
      returning id
    ), removed as (
      delete from social_post_draft_destinations using claimed
      where social_post_draft_destinations.post_id = claimed.id
        and social_post_draft_destinations.workspace_id = ${input.workspaceId}::uuid
      returning connection_id
    ), inserted as (
      insert into social_post_draft_destinations (post_id, workspace_id, connection_id)
      select claimed.id, ${input.workspaceId}::uuid, destination.id::uuid
      from claimed cross join jsonb_array_elements_text(${JSON.stringify(input.connectionIds)}::jsonb) destination(id)
      cross join (select count(*) from removed) removal_barrier
      returning connection_id
    ), prepared as (
      insert into mcp_operations (
        id, workspace_id, connection_id, user_id, kind, idempotency_key,
        fingerprint, input, status, approval_hash, expires_at
      )
      select ${operationId}::uuid, ${input.workspaceId}::uuid,
        ${input.connectionId}::uuid, ${input.userId}::uuid, ${input.kind},
        ${input.idempotencyKey}, ${input.fingerprint}, ${JSON.stringify(input.input)}::jsonb,
        ${input.status}, ${input.approvalHash ?? null}, ${input.expiresAt.toISOString()}::timestamptz
      from claimed cross join (select count(*) from inserted) insertion_barrier
      returning id
    ) select id from prepared
  `);
  if (!result.rows.length) return null;
  const [operation] = await database
    .select()
    .from(mcpOperations)
    .where(
      and(
        eq(mcpOperations.id, operationId),
        eq(mcpOperations.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return operation ? { created: true, operation } : null;
}
