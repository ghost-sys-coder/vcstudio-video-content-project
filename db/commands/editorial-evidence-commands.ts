import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectSources,
  scriptClaims,
  scriptClaimSources,
  scriptEditorialSignoffs,
  type ProjectSource,
  type ScriptClaim,
} from "@/db/schema";
import type {
  ClaimReviewState,
  ClaimSourceStance,
} from "@/lib/editorial/editorial-review";
import type { EditorialSourceKind } from "@/db/schema";

/**
 * Writes for the editorial review record.
 *
 * Every statement carries `workspace_id` in its `where` clause even where a
 * foreign key already constrains the row, so a mistaken id from a caller cannot
 * reach another tenant. Nothing here calls a provider or reserves usage: the
 * whole slice is manual review, and adding a source costs nothing.
 */

export async function createProjectSource(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  kind: EditorialSourceKind;
  title: string;
  url: string | null;
  host: string | null;
  notes: string;
}): Promise<ProjectSource> {
  const rows = await getDatabase()
    .insert(projectSources)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      kind: input.kind,
      title: input.title,
      url: input.url,
      host: input.host,
      notes: input.notes,
      addedByUserId: input.userId,
    })
    .returning();
  const created = rows[0];
  if (!created) throw new Error("SOURCE_NOT_CREATED");
  return created;
}

/**
 * Archives a source rather than deleting it.
 *
 * A deleted source would leave every claim it justified reading as reviewed
 * with nothing behind it. The database refuses the delete outright through the
 * citation foreign key; this is the supported way to retire one.
 */
export async function archiveProjectSource(input: {
  workspaceId: string;
  projectId: string;
  sourceId: string;
}): Promise<boolean> {
  const rows = await getDatabase()
    .update(projectSources)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(projectSources.id, input.sourceId),
        eq(projectSources.workspaceId, input.workspaceId),
        eq(projectSources.projectId, input.projectId),
      ),
    )
    .returning({ id: projectSources.id });
  return rows.length > 0;
}

export async function createScriptClaim(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  quotedText: string;
}): Promise<ScriptClaim> {
  const rows = await getDatabase()
    .insert(scriptClaims)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      quotedText: input.quotedText,
      createdByUserId: input.userId,
    })
    .returning();
  const created = rows[0];
  if (!created) throw new Error("CLAIM_NOT_CREATED");
  return created;
}

/**
 * Records a verdict on a claim.
 *
 * Returning to `unchecked` clears the reviewer and the timestamp, so the row
 * cannot keep an attribution for a decision that has been withdrawn. The
 * table's own check constraint enforces the same pairing.
 */
export async function reviewScriptClaim(input: {
  workspaceId: string;
  projectId: string;
  claimId: string;
  userId: string;
  reviewState: ClaimReviewState;
  reviewNote: string;
}): Promise<boolean> {
  const checked = input.reviewState !== "unchecked";
  const rows = await getDatabase()
    .update(scriptClaims)
    .set({
      reviewState: input.reviewState,
      reviewNote: input.reviewNote,
      reviewedByUserId: checked ? input.userId : null,
      reviewedAt: checked ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scriptClaims.id, input.claimId),
        eq(scriptClaims.workspaceId, input.workspaceId),
        eq(scriptClaims.projectId, input.projectId),
      ),
    )
    .returning({ id: scriptClaims.id });
  return rows.length > 0;
}

/**
 * Removes a claim and, with it, its citations.
 *
 * Deleting a claim is legitimate: the sentence it quoted may have been cut from
 * the script entirely. What must not happen is the deletion leaving a sign-off
 * that silently covers one fewer claim, and `resolveEditorialSignoff` reads
 * that case as invalidating.
 */
export async function deleteScriptClaim(input: {
  workspaceId: string;
  projectId: string;
  claimId: string;
}): Promise<boolean> {
  const rows = await getDatabase()
    .delete(scriptClaims)
    .where(
      and(
        eq(scriptClaims.id, input.claimId),
        eq(scriptClaims.workspaceId, input.workspaceId),
        eq(scriptClaims.projectId, input.projectId),
      ),
    )
    .returning({ id: scriptClaims.id });
  return rows.length > 0;
}

/**
 * Cites a source for or against a claim.
 *
 * The claim and the source are re-checked against the workspace and project in
 * the same statement that inserts, so a caller cannot cite another workspace's
 * source by supplying its id. Re-citing the same source updates its stance
 * rather than adding a duplicate.
 */
export async function citeSourceForClaim(input: {
  workspaceId: string;
  projectId: string;
  claimId: string;
  sourceId: string;
  userId: string;
  stance: ClaimSourceStance;
  excerpt: string;
}): Promise<boolean> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    insert into script_claim_sources
      (workspace_id, claim_id, source_id, stance, excerpt, created_by_user_id)
    select ${input.workspaceId}::uuid, c.id, s.id, ${input.stance}::claim_source_stance,
      ${input.excerpt}, ${input.userId}::uuid
    from script_claims c
    join project_sources s
      on s.workspace_id = c.workspace_id and s.project_id = c.project_id
    where c.id = ${input.claimId}::uuid
      and c.workspace_id = ${input.workspaceId}::uuid
      and c.project_id = ${input.projectId}::uuid
      and s.id = ${input.sourceId}::uuid
      and s.archived_at is null
    on conflict (claim_id, source_id)
      do update set stance = excluded.stance, excerpt = excluded.excerpt
    returning id
  `);
  return result.rows.length > 0;
}

export async function removeClaimCitation(input: {
  workspaceId: string;
  claimId: string;
  sourceId: string;
}): Promise<boolean> {
  const rows = await getDatabase()
    .delete(scriptClaimSources)
    .where(
      and(
        eq(scriptClaimSources.workspaceId, input.workspaceId),
        eq(scriptClaimSources.claimId, input.claimId),
        eq(scriptClaimSources.sourceId, input.sourceId),
      ),
    )
    .returning({ id: scriptClaimSources.id });
  return rows.length > 0;
}

/**
 * Records that a person signed off on the review as it currently stands.
 *
 * One row per project, replaced each time. The covered claims and the script
 * fingerprint are supplied by the caller from the same read it showed the
 * reviewer, so the sign-off records what was actually on screen rather than
 * whatever the database happened to hold a moment later.
 */
export async function recordEditorialSignoff(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  scriptFingerprint: string;
  coveredClaims: { id: string; reviewState: ClaimReviewState }[];
  note: string;
}): Promise<void> {
  await getDatabase()
    .insert(scriptEditorialSignoffs)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      scriptFingerprint: input.scriptFingerprint,
      coveredClaims: input.coveredClaims,
      note: input.note,
      signedByUserId: input.userId,
      signedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: scriptEditorialSignoffs.projectId,
      set: {
        scriptFingerprint: input.scriptFingerprint,
        coveredClaims: input.coveredClaims,
        note: input.note,
        signedByUserId: input.userId,
        signedAt: new Date(),
      },
    });
}

/** Withdraws a sign-off. Used when a reviewer changes their mind explicitly. */
export async function clearEditorialSignoff(input: {
  workspaceId: string;
  projectId: string;
}): Promise<void> {
  await getDatabase()
    .delete(scriptEditorialSignoffs)
    .where(
      and(
        eq(scriptEditorialSignoffs.workspaceId, input.workspaceId),
        eq(scriptEditorialSignoffs.projectId, input.projectId),
      ),
    );
}
