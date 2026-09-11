import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectSources,
  scriptClaims,
  scriptClaimSources,
  scriptEditorialSignoffs,
  scriptVersionEvidence,
  type ProjectSource,
  type ScriptClaim,
  type ScriptClaimSource,
  type ScriptEditorialSignoff,
  type ScriptVersionEvidence,
} from "@/db/schema";

/** Every query here is scoped by workspace as well as project, per AGENTS.md. */
export interface ProjectScope {
  workspaceId: string;
  projectId: string;
}

/**
 * Sources for a project.
 *
 * Archived sources are excluded by default because they should not be offered
 * for new citations, but they are still readable by id so an existing citation
 * never resolves to nothing.
 */
export async function listProjectSources(
  scope: ProjectScope,
  options: { includeArchived?: boolean } = {},
): Promise<ProjectSource[]> {
  const conditions = [
    eq(projectSources.workspaceId, scope.workspaceId),
    eq(projectSources.projectId, scope.projectId),
  ];
  if (!options.includeArchived)
    conditions.push(isNull(projectSources.archivedAt));
  return getDatabase()
    .select()
    .from(projectSources)
    .where(and(...conditions))
    .orderBy(asc(projectSources.createdAt));
}

export async function listScriptClaims(
  scope: ProjectScope,
): Promise<ScriptClaim[]> {
  return getDatabase()
    .select()
    .from(scriptClaims)
    .where(
      and(
        eq(scriptClaims.workspaceId, scope.workspaceId),
        eq(scriptClaims.projectId, scope.projectId),
      ),
    )
    .orderBy(asc(scriptClaims.createdAt));
}

/**
 * Citations for a set of claims, in one query.
 *
 * A per-claim query would grow with the number of claims on the page, which is
 * the count most likely to get large in a script that is being reviewed
 * properly.
 */
export async function listClaimCitations(input: {
  workspaceId: string;
  claimIds: readonly string[];
}): Promise<ScriptClaimSource[]> {
  if (input.claimIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(scriptClaimSources)
    .where(
      and(
        eq(scriptClaimSources.workspaceId, input.workspaceId),
        inArray(scriptClaimSources.claimId, [...input.claimIds]),
      ),
    )
    .orderBy(asc(scriptClaimSources.createdAt));
}

export async function findEditorialSignoff(
  scope: ProjectScope,
): Promise<ScriptEditorialSignoff | null> {
  const rows = await getDatabase()
    .select()
    .from(scriptEditorialSignoffs)
    .where(
      and(
        eq(scriptEditorialSignoffs.workspaceId, scope.workspaceId),
        eq(scriptEditorialSignoffs.projectId, scope.projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** The frozen review for one approved version. Never recomputed. */
export async function findScriptVersionEvidence(input: {
  workspaceId: string;
  scriptVersionId: string;
}): Promise<ScriptVersionEvidence | null> {
  const rows = await getDatabase()
    .select()
    .from(scriptVersionEvidence)
    .where(
      and(
        eq(scriptVersionEvidence.workspaceId, input.workspaceId),
        eq(scriptVersionEvidence.scriptVersionId, input.scriptVersionId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
