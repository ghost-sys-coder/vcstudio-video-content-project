import "server-only";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  characters,
  sceneVersionCharacters,
  type CharacterStatus,
} from "@/db/schema";

export async function listCharacters(input: {
  workspaceId: string;
  excludeArchived?: boolean;
  status?: CharacterStatus;
}) {
  const conditions = [eq(characters.workspaceId, input.workspaceId)];
  if (input.excludeArchived) conditions.push(ne(characters.status, "archived"));
  if (input.status) conditions.push(eq(characters.status, input.status));
  return getDatabase()
    .select()
    .from(characters)
    .where(and(...conditions))
    .orderBy(asc(characters.name))
    .limit(500);
}

export async function findCharacter(input: {
  workspaceId: string;
  characterId: string;
}) {
  const [character] = await getDatabase()
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.workspaceId, input.workspaceId),
        eq(characters.id, input.characterId),
      ),
    )
    .limit(1);
  return character ?? null;
}

export async function findCharacterBySlug(input: {
  workspaceId: string;
  slug: string;
}) {
  const [character] = await getDatabase()
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.workspaceId, input.workspaceId),
        eq(characters.slug, input.slug),
      ),
    )
    .limit(1);
  return character ?? null;
}

export async function listCharacterReferences(input: {
  workspaceId: string;
  characterId: string;
}) {
  return getDatabase()
    .select()
    .from(characterReferenceAssets)
    .where(
      and(
        eq(characterReferenceAssets.workspaceId, input.workspaceId),
        eq(characterReferenceAssets.characterId, input.characterId),
      ),
    )
    .orderBy(desc(characterReferenceAssets.createdAt))
    .limit(200);
}

export async function findCharacterReference(input: {
  workspaceId: string;
  characterId: string;
  referenceId: string;
}) {
  const [reference] = await getDatabase()
    .select()
    .from(characterReferenceAssets)
    .where(
      and(
        eq(characterReferenceAssets.workspaceId, input.workspaceId),
        eq(characterReferenceAssets.characterId, input.characterId),
        eq(characterReferenceAssets.id, input.referenceId),
      ),
    )
    .limit(1);
  return reference ?? null;
}

export async function listSceneVersionCharacters(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  if (!input.sceneVersionIds.length) return [];
  return getDatabase()
    .select({ assignment: sceneVersionCharacters, character: characters })
    .from(sceneVersionCharacters)
    .innerJoin(
      characters,
      eq(characters.id, sceneVersionCharacters.characterId),
    )
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, input.workspaceId),
        eq(sceneVersionCharacters.projectId, input.projectId),
        inArray(sceneVersionCharacters.sceneVersionId, input.sceneVersionIds),
      ),
    )
    .orderBy(asc(characters.name));
}

export async function listCharactersByIds(input: {
  workspaceId: string;
  characterIds: string[];
  status?: CharacterStatus;
}) {
  if (!input.characterIds.length) return [];
  const conditions = [
    eq(characters.workspaceId, input.workspaceId),
    inArray(characters.id, input.characterIds),
  ];
  if (input.status) conditions.push(eq(characters.status, input.status));
  return getDatabase()
    .select()
    .from(characters)
    .where(and(...conditions));
}
