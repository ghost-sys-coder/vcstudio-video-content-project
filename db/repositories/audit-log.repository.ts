import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { auditLogEvents, users, type AuditAction } from "@/db/schema";
import type { AuditMetadata } from "@/lib/audit/audit-actions";
import { calculatePagination } from "@/lib/domain/pagination";

export async function insertAuditLogEvent(input: {
  workspaceId: string;
  actorUserId: string | null;
  projectId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  safeMetadata: AuditMetadata;
}): Promise<void> {
  await getDatabase().insert(auditLogEvents).values({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    safeMetadata: input.safeMetadata,
  });
}

export type AuditLogEntry = {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  actorName: string | null;
  projectId: string | null;
  targetType: string;
  targetId: string | null;
  safeMetadata: AuditMetadata;
  createdAt: Date;
};

export async function listAuditLogEvents(input: {
  workspaceId: string;
  page: number;
  pageSize: number;
  action?: AuditAction | null;
  projectId?: string | null;
}): Promise<{
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const filters = [eq(auditLogEvents.workspaceId, input.workspaceId)];
  if (input.action) filters.push(eq(auditLogEvents.action, input.action));
  if (input.projectId)
    filters.push(eq(auditLogEvents.projectId, input.projectId));
  const where = and(...filters);
  const offset = calculatePagination({ ...input, total: 0 }).offset;

  const [rows, totals] = await Promise.all([
    getDatabase()
      .select({
        id: auditLogEvents.id,
        action: auditLogEvents.action,
        actorUserId: auditLogEvents.actorUserId,
        actorName: users.displayName,
        projectId: auditLogEvents.projectId,
        targetType: auditLogEvents.targetType,
        targetId: auditLogEvents.targetId,
        safeMetadata: auditLogEvents.safeMetadata,
        createdAt: auditLogEvents.createdAt,
      })
      .from(auditLogEvents)
      .leftJoin(users, eq(users.id, auditLogEvents.actorUserId))
      .where(where)
      .orderBy(desc(auditLogEvents.createdAt), desc(auditLogEvents.id))
      .limit(input.pageSize)
      .offset(offset),
    getDatabase().select({ value: count() }).from(auditLogEvents).where(where),
  ]);

  const total = totals[0]?.value ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorUserId: row.actorUserId,
      actorName: row.actorName ?? null,
      projectId: row.projectId,
      targetType: row.targetType,
      targetId: row.targetId,
      safeMetadata: row.safeMetadata,
      createdAt: row.createdAt,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: calculatePagination({ ...input, total }).pageCount,
  };
}
