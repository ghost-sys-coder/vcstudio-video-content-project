import "server-only";

import { and, count, desc, eq, max } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptDrafts,
  projectScriptVersions,
  projects,
} from "@/db/schema";
import { calculatePagination } from "@/lib/domain/pagination";

export async function listProjects(input: {
  workspaceId: string;
  page: number;
  pageSize: number;
}) {
  const offset = calculatePagination({ ...input, total: 0 }).offset;
  const [items, totals] = await Promise.all([
    getDatabase()
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, input.workspaceId))
      .orderBy(desc(projects.updatedAt), desc(projects.id))
      .limit(input.pageSize)
      .offset(offset),
    getDatabase()
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.workspaceId, input.workspaceId)),
  ]);
  const total = totals[0]?.value ?? 0;
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: calculatePagination({ ...input, total }).pageCount,
  };
}

export async function findProject(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [project] = await getDatabase()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.id, input.projectId),
      ),
    )
    .limit(1);
  return project ?? null;
}

export async function findProjectScriptDraft(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [draft] = await getDatabase()
    .select()
    .from(projectScriptDrafts)
    .where(
      and(
        eq(projectScriptDrafts.workspaceId, input.workspaceId),
        eq(projectScriptDrafts.projectId, input.projectId),
      ),
    )
    .limit(1);
  return draft ?? null;
}

export async function listProjectScriptVersions(input: {
  workspaceId: string;
  projectId: string;
  limit?: number;
}) {
  return getDatabase()
    .select()
    .from(projectScriptVersions)
    .where(
      and(
        eq(projectScriptVersions.workspaceId, input.workspaceId),
        eq(projectScriptVersions.projectId, input.projectId),
      ),
    )
    .orderBy(desc(projectScriptVersions.versionNumber))
    .limit(input.limit ?? 50);
}

export async function findProjectScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  versionId: string;
}) {
  const [version] = await getDatabase()
    .select()
    .from(projectScriptVersions)
    .where(
      and(
        eq(projectScriptVersions.workspaceId, input.workspaceId),
        eq(projectScriptVersions.projectId, input.projectId),
        eq(projectScriptVersions.id, input.versionId),
      ),
    )
    .limit(1);
  return version ?? null;
}

export async function getLatestProjectScriptVersionNumber(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [result] = await getDatabase()
    .select({ value: max(projectScriptVersions.versionNumber) })
    .from(projectScriptVersions)
    .where(
      and(
        eq(projectScriptVersions.workspaceId, input.workspaceId),
        eq(projectScriptVersions.projectId, input.projectId),
      ),
    );
  return result?.value ?? 0;
}
