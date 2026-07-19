import "server-only";

import { insertAuditLogEvent } from "@/db/repositories/audit-log.repository";
import {
  sanitizeAuditMetadata,
  type AuditAction,
} from "@/lib/audit/audit-actions";

/**
 * Records a single audit event.
 *
 * The audit trail is best-effort supplementary history: a failed audit write
 * must never roll back or fail an already-authorized, already-committed
 * mutation. A failure is therefore logged (not silently discarded) and
 * swallowed so the primary operation still succeeds. Metadata is passed through
 * {@link sanitizeAuditMetadata} so secrets and signed URLs never reach storage.
 */
export async function recordAuditEvent(input: {
  workspaceId: string;
  actorUserId?: string | null;
  projectId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await insertAuditLogEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      projectId: input.projectId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      safeMetadata: sanitizeAuditMetadata(input.metadata ?? {}),
    });
  } catch (error) {
    console.error("Failed to record audit event", {
      action: input.action,
      workspaceId: input.workspaceId,
      targetType: input.targetType,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}
