import "server-only";
import type { McpPublicOperation } from "@studio/contracts";
import {
  beginMcpOperation,
  updateMcpOperation,
  type McpOperation,
} from "@/db/repositories/mcp.repository";
import type { McpContext } from "./context";
import { requireMcp, McpError } from "./errors";
import { fingerprint } from "./fingerprint";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
export function publicOperation(row: McpOperation): McpPublicOperation {
  const expired =
    row.expiresAt <= new Date() &&
    [
      "awaiting_upload",
      "requires_approval",
      "prepared",
      "queued",
      "running",
    ].includes(row.status);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    status: expired ? "expired" : row.status,
    result: row.result,
    error:
      row.error ??
      (expired
        ? "This request expired. Inspect current content before starting a fresh request."
        : null),
    expiresAt: row.expiresAt.toISOString(),
    href: `/app/mcp/operations/${row.id}?workspaceId=${row.workspaceId}`,
  };
}
export async function mutateOnce(
  context: McpContext,
  kind: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
  execute: (operationId: string) => Promise<Record<string, unknown>>,
) {
  const started = await beginMcpOperation({
    workspaceId: context.workspaceId,
    connectionId: context.connection.id,
    userId: context.principal.userId,
    kind,
    idempotencyKey,
    fingerprint: fingerprint({ kind, input }),
    status: "running",
    input,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  requireMcp(
    started.operation.fingerprint === fingerprint({ kind, input }),
    "conflict",
    "That idempotency key was already used for different inputs.",
  );
  if (!started.created) return publicOperation(started.operation);
  try {
    const result = await execute(started.operation.id);
    const completed = await updateMcpOperation({
      operationId: started.operation.id,
      workspaceId: context.workspaceId,
      from: ["running"],
      values: { status: "succeeded", result },
    });
    await recordAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.principal.userId,
      action: "mcp_action_completed",
      targetType: "mcp_operation",
      targetId: started.operation.id,
      metadata: { clientId: context.principal.clientId, kind },
    });
    return publicOperation(completed ?? started.operation);
  } catch (error) {
    const message =
      error instanceof McpError
        ? error.message
        : "The action could not be completed. Inspect the current content before starting a new request.";
    await updateMcpOperation({
      operationId: started.operation.id,
      workspaceId: context.workspaceId,
      from: ["running"],
      values: { status: "failed", error: message },
    });
    await recordAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.principal.userId,
      action: "mcp_action_failed",
      targetType: "mcp_operation",
      targetId: started.operation.id,
      metadata: { clientId: context.principal.clientId, kind },
    });
    throw error instanceof McpError
      ? error
      : new McpError("action_failed", message);
  }
}
