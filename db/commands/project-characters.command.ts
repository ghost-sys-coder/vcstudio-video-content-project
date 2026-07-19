import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projectCharacters, sceneVersionCharacters } from "@/db/schema";
import { listCharactersByIds } from "@/db/repositories/characters.repository";
import {
  countProjectCast,
  listProjectCast,
} from "@/db/repositories/project-characters.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { matchCharacterNamesToCast } from "@/lib/scenes/character-name-matching";

// Hard cap on cast size to keep bulk assignment bounded. A project rarely needs
// more distinct principal characters than this.
export const MAX_PROJECT_CAST_SIZE = 25;

export type ApplyCastMode = "matched" | "all";

export type ApplyCastResult = {
  castSize: number;
  scenesAffected: number;
  assignmentsCreated: number;
};

/**
 * Add an active workspace character to a project's cast. Idempotent: re-adding a
 * character already in the cast is a no-op. Does not itself assign the character
 * to any scene — use {@link applyCastToScenes} for that.
 */
export async function addCharacterToProjectCast(input: {
  workspaceId: string;
  projectId: string;
  characterId: string;
  userId: string;
}): Promise<void> {
  const [character] = await listCharactersByIds({
    workspaceId: input.workspaceId,
    characterIds: [input.characterId],
    status: "active",
  });
  if (!character) throw new Error("CHARACTER_UNAVAILABLE");
  const currentSize = await countProjectCast({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });
  if (currentSize >= MAX_PROJECT_CAST_SIZE)
    throw new Error("PROJECT_CAST_LIMIT_REACHED");
  await getDatabase()
    .insert(projectCharacters)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      characterId: input.characterId,
      addedByUserId: input.userId,
    })
    .onConflictDoNothing();
}

/**
 * Remove a character from a project's cast. Existing per-scene assignments are
 * intentionally preserved — removing from the cast only stops future
 * auto-application, it does not retroactively unassign the character.
 */
export async function removeCharacterFromProjectCast(input: {
  workspaceId: string;
  projectId: string;
  characterId: string;
}): Promise<void> {
  await getDatabase()
    .delete(projectCharacters)
    .where(
      and(
        eq(projectCharacters.workspaceId, input.workspaceId),
        eq(projectCharacters.projectId, input.projectId),
        eq(projectCharacters.characterId, input.characterId),
      ),
    );
}

/**
 * Assign the project cast across the project's current scene versions.
 *
 * - `mode: "matched"` assigns each cast member only to scenes whose analysis
 *   named them (via {@link matchCharacterNamesToCast}).
 * - `mode: "all"` assigns the entire cast to every current scene version.
 *
 * Additive and idempotent: existing assignments (including manual ones) are
 * preserved; only missing `(sceneVersion, character)` links are inserted.
 */
export async function applyCastToScenes(input: {
  workspaceId: string;
  projectId: string;
  mode: ApplyCastMode;
  userId: string;
}): Promise<ApplyCastResult> {
  const scope = { workspaceId: input.workspaceId, projectId: input.projectId };
  const [cast, sceneRows] = await Promise.all([
    listProjectCast(scope),
    listCurrentScenes(scope),
  ]);
  if (cast.length === 0 || sceneRows.length === 0)
    return { castSize: cast.length, scenesAffected: 0, assignmentsCreated: 0 };

  const candidates = cast.map((member) => ({
    id: member.characterId,
    name: member.character.name,
  }));
  const rows: (typeof sceneVersionCharacters.$inferInsert)[] = [];
  let scenesAffected = 0;
  for (const { version } of sceneRows) {
    const targetIds =
      input.mode === "all"
        ? cast.map((member) => member.characterId)
        : matchCharacterNamesToCast(version.characterNames ?? [], candidates);
    if (targetIds.length === 0) continue;
    scenesAffected += 1;
    for (const characterId of targetIds) {
      rows.push({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sceneVersionId: version.id,
        characterId,
        assignedByUserId: input.userId,
      });
    }
  }
  if (rows.length === 0)
    return { castSize: cast.length, scenesAffected: 0, assignmentsCreated: 0 };

  const inserted = await getDatabase()
    .insert(sceneVersionCharacters)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: sceneVersionCharacters.id });
  return {
    castSize: cast.length,
    scenesAffected,
    assignmentsCreated: inserted.length,
  };
}
