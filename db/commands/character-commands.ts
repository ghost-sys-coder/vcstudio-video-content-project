import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterAuditEvents,
  characterReferenceAssets,
  characters,
  sceneVersionCharacters,
  type CharacterReferenceType,
  type CharacterStatus,
} from "@/db/schema";
import {
  createCharacterSlug,
  singleCharacterReferenceTypes,
} from "@/lib/domain/character";
import {
  findCharacter,
  findCharacterBySlug,
  findCharacterReference,
  listCharactersByIds,
} from "@/db/repositories/characters.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";

export type CharacterFields = {
  name: string;
  description: string;
  visualIdentity: string;
  bodyProportions: string;
  faceDescription: string;
  hairDescription: string;
  skinToneDescription: string;
  defaultOutfitDescription: string;
  personalityNotes: string;
  continuityRules: string;
  negativeConstraints: string;
  status: Exclude<CharacterStatus, "archived">;
};

export async function createCharacter(
  input: CharacterFields & {
    workspaceId: string;
    userId: string;
  },
) {
  const slug = createCharacterSlug(input.name);
  if (await findCharacterBySlug({ workspaceId: input.workspaceId, slug }))
    throw new Error("CHARACTER_SLUG_EXISTS");
  const { workspaceId, userId, ...fields } = input;
  const [created] = await getDatabase()
    .insert(characters)
    .values({ ...fields, workspaceId, slug, createdByUserId: userId })
    .returning();
  if (!created) throw new Error("CHARACTER_CREATE_FAILED");
  return created;
}

export async function updateCharacter(
  input: CharacterFields & {
    workspaceId: string;
    characterId: string;
  },
) {
  const current = await findCharacter(input);
  if (!current || current.status === "archived")
    throw new Error("CHARACTER_UNAVAILABLE");
  const slug = createCharacterSlug(input.name);
  const conflicting = await findCharacterBySlug({
    workspaceId: input.workspaceId,
    slug,
  });
  if (conflicting && conflicting.id !== input.characterId)
    throw new Error("CHARACTER_SLUG_EXISTS");
  const { workspaceId, characterId, ...fields } = input;
  const [updated] = await getDatabase()
    .update(characters)
    .set({ ...fields, slug, updatedAt: new Date() })
    .where(
      and(
        eq(characters.workspaceId, workspaceId),
        eq(characters.id, characterId),
      ),
    )
    .returning();
  return updated;
}

export async function archiveCharacter(input: {
  workspaceId: string;
  characterId: string;
  userId: string;
}) {
  const [updated] = await getDatabase()
    .update(characters)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(characters.workspaceId, input.workspaceId),
        eq(characters.id, input.characterId),
      ),
    )
    .returning();
  if (!updated) throw new Error("CHARACTER_NOT_FOUND");
  await getDatabase().insert(characterAuditEvents).values({
    workspaceId: input.workspaceId,
    characterId: input.characterId,
    action: "archived",
    actorUserId: input.userId,
  });
}

export async function saveCharacterReference(input: {
  workspaceId: string;
  characterId: string;
  type: CharacterReferenceType;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  etag: string | null;
  userId: string;
}) {
  const character = await findCharacter(input);
  if (!character || character.status === "archived")
    throw new Error("CHARACTER_UNAVAILABLE");
  let previous: typeof characterReferenceAssets.$inferSelect | null = null;
  if (singleCharacterReferenceTypes.has(input.type)) {
    const [existing] = await getDatabase()
      .select()
      .from(characterReferenceAssets)
      .where(
        and(
          eq(characterReferenceAssets.workspaceId, input.workspaceId),
          eq(characterReferenceAssets.characterId, input.characterId),
          eq(characterReferenceAssets.type, input.type),
        ),
      )
      .limit(1);
    previous = existing ?? null;
  }
  const referenceId = crypto.randomUUID();
  if (previous) {
    await getDatabase().batch([
      getDatabase()
        .delete(characterReferenceAssets)
        .where(eq(characterReferenceAssets.id, previous.id)),
      getDatabase().insert(characterAuditEvents).values({
        workspaceId: input.workspaceId,
        characterId: input.characterId,
        referenceAssetId: previous.id,
        action: "referenceReplaced",
        actorUserId: input.userId,
      }),
      getDatabase().insert(characterReferenceAssets).values({
        id: referenceId,
        workspaceId: input.workspaceId,
        characterId: input.characterId,
        type: input.type,
        source: "uploaded",
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        etag: input.etag,
        createdByUserId: input.userId,
      }),
    ]);
  } else {
    await getDatabase().insert(characterReferenceAssets).values({
      id: referenceId,
      workspaceId: input.workspaceId,
      characterId: input.characterId,
      type: input.type,
      source: "uploaded",
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      etag: input.etag,
      createdByUserId: input.userId,
    });
  }
  return { referenceId, previous };
}

export async function deleteCharacterReference(input: {
  workspaceId: string;
  characterId: string;
  referenceId: string;
  userId: string;
}) {
  const reference = await findCharacterReference(input);
  if (!reference) throw new Error("REFERENCE_NOT_FOUND");
  await getDatabase().batch([
    getDatabase()
      .delete(characterReferenceAssets)
      .where(
        and(
          eq(characterReferenceAssets.workspaceId, input.workspaceId),
          eq(characterReferenceAssets.id, input.referenceId),
        ),
      ),
    getDatabase().insert(characterAuditEvents).values({
      workspaceId: input.workspaceId,
      characterId: input.characterId,
      referenceAssetId: input.referenceId,
      action: "referenceDeleted",
      actorUserId: input.userId,
    }),
  ]);
  return reference;
}

export async function assignSceneCharacters(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  characterIds: string[];
  userId: string;
}) {
  const current = await findCurrentScene(input);
  if (!current || current.version.id !== input.sceneVersionId)
    throw new Error("SCENE_VERSION_NOT_CURRENT");
  const uniqueIds = [...new Set(input.characterIds)];
  const available = await listCharactersByIds({
    workspaceId: input.workspaceId,
    characterIds: uniqueIds,
    status: "active",
  });
  if (available.length !== uniqueIds.length)
    throw new Error("CHARACTER_UNAVAILABLE");
  const insert = uniqueIds.length
    ? [
        getDatabase()
          .insert(sceneVersionCharacters)
          .values(
            uniqueIds.map((characterId) => ({
              workspaceId: input.workspaceId,
              projectId: input.projectId,
              sceneVersionId: input.sceneVersionId,
              characterId,
              assignedByUserId: input.userId,
            })),
          ),
      ]
    : [];
  await getDatabase().batch([
    getDatabase()
      .delete(sceneVersionCharacters)
      .where(
        and(
          eq(sceneVersionCharacters.workspaceId, input.workspaceId),
          eq(sceneVersionCharacters.projectId, input.projectId),
          eq(sceneVersionCharacters.sceneVersionId, input.sceneVersionId),
        ),
      ),
    ...insert,
  ]);
}
