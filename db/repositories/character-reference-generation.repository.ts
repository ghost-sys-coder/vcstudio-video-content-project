import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceGenerations,
  type CharacterReferenceGeneration,
} from "@/db/schema";

export async function findCharacterReferenceGeneration(input: {
  workspaceId: string;
  generationId: string;
}): Promise<CharacterReferenceGeneration | null> {
  const [row] = await getDatabase()
    .select()
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.id, input.generationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findCharacterReferenceGenerationByRequestNonce(input: {
  workspaceId: string;
  requestNonce: string;
}): Promise<CharacterReferenceGeneration | null> {
  const [row] = await getDatabase()
    .select()
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listCharacterReferenceGenerations(input: {
  workspaceId: string;
  characterId: string;
  limit?: number;
}): Promise<CharacterReferenceGeneration[]> {
  return getDatabase()
    .select()
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.characterId, input.characterId),
      ),
    )
    .orderBy(desc(characterReferenceGenerations.createdAt))
    .limit(input.limit ?? 50);
}

export async function countActiveCharacterReferenceGenerations(input: {
  workspaceId: string;
  characterId: string;
}): Promise<number> {
  const rows = await getDatabase()
    .select({ id: characterReferenceGenerations.id })
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        eq(characterReferenceGenerations.characterId, input.characterId),
      ),
    );
  return rows.length;
}

/**
 * Workspace committed portrait spend within a window: reserved while
 * queued/running, actual once succeeded, nothing once failed. Mirrors the
 * committed-cost semantics of the money-safe ledger so the workspace budget
 * preflight can include portrait spend the ledger does not track.
 */
export async function getWorkspaceCharacterReferenceCommittedCents(input: {
  workspaceId: string;
  since: Date;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({
      committed: sql<number>`coalesce(sum(case
        when ${characterReferenceGenerations.status} in ('queued','running')
          then ${characterReferenceGenerations.estimatedCostCents}
        when ${characterReferenceGenerations.status} = 'succeeded'
          then coalesce(${characterReferenceGenerations.actualCostCents}, 0)
        else 0 end), 0)::int`,
    })
    .from(characterReferenceGenerations)
    .where(
      and(
        eq(characterReferenceGenerations.workspaceId, input.workspaceId),
        gte(characterReferenceGenerations.createdAt, input.since),
      ),
    );
  return Number(row?.committed ?? 0);
}
