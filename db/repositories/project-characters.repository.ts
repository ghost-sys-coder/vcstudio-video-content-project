import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { characters, projectCharacters, type Character } from "@/db/schema";

export type ProjectCastMember = {
  characterId: string;
  addedByUserId: string;
  character: Character;
};

/**
 * List a project's cast (the characters declared for the project), ordered by
 * character name. Workspace + project scoped.
 */
export async function listProjectCast(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProjectCastMember[]> {
  const rows = await getDatabase()
    .select({ assignment: projectCharacters, character: characters })
    .from(projectCharacters)
    .innerJoin(characters, eq(characters.id, projectCharacters.characterId))
    .where(
      and(
        eq(projectCharacters.workspaceId, input.workspaceId),
        eq(projectCharacters.projectId, input.projectId),
      ),
    )
    .orderBy(asc(characters.name))
    .limit(200);
  return rows.map((row) => ({
    characterId: row.assignment.characterId,
    addedByUserId: row.assignment.addedByUserId,
    character: row.character,
  }));
}

/** Count the characters currently in a project's cast. */
export async function countProjectCast(input: {
  workspaceId: string;
  projectId: string;
}): Promise<number> {
  const rows = await getDatabase()
    .select({ characterId: projectCharacters.characterId })
    .from(projectCharacters)
    .where(
      and(
        eq(projectCharacters.workspaceId, input.workspaceId),
        eq(projectCharacters.projectId, input.projectId),
      ),
    );
  return rows.length;
}
