import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  characters,
  sceneAnimationDirections,
  type Character,
  type CharacterReferenceType,
} from "@/db/schema";

export const ANIMATION_POSE_TYPES = [
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
] as const satisfies readonly CharacterReferenceType[];

export async function findSceneAnimationDirection(input: {
  workspaceId: string;
  sceneVersionId: string;
}) {
  const [direction] = await getDatabase()
    .select()
    .from(sceneAnimationDirections)
    .where(
      and(
        eq(sceneAnimationDirections.workspaceId, input.workspaceId),
        eq(sceneAnimationDirections.sceneVersionId, input.sceneVersionId),
      ),
    )
    .limit(1);
  return direction ?? null;
}

export async function listSceneAnimationDirectionsForVersions(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  if (!input.sceneVersionIds.length) return [];
  return getDatabase()
    .select()
    .from(sceneAnimationDirections)
    .where(
      and(
        eq(sceneAnimationDirections.workspaceId, input.workspaceId),
        eq(sceneAnimationDirections.projectId, input.projectId),
        inArray(sceneAnimationDirections.sceneVersionId, input.sceneVersionIds),
      ),
    );
}

/**
 * Active characters that have all four pose stills generated — the only
 * characters eligible to animate a scene, since a partial pose set can't be
 * rendered (see resolveAnimatedCharactersBySceneVersion).
 */
export async function listAnimationReadyCharacters(input: {
  workspaceId: string;
}): Promise<Character[]> {
  const rows = await getDatabase()
    .select({ character: characters })
    .from(characters)
    .innerJoin(
      characterReferenceAssets,
      and(
        eq(characterReferenceAssets.characterId, characters.id),
        eq(characterReferenceAssets.workspaceId, characters.workspaceId),
        inArray(characterReferenceAssets.type, ANIMATION_POSE_TYPES),
      ),
    )
    .where(
      and(
        eq(characters.workspaceId, input.workspaceId),
        eq(characters.status, "active"),
      ),
    )
    .groupBy(characters.id)
    .having(
      sql`count(distinct ${characterReferenceAssets.type}) = ${ANIMATION_POSE_TYPES.length}`,
    )
    .orderBy(characters.name)
    .limit(500);
  return rows.map((row) => row.character);
}

/**
 * The character's four current pose stills (idle/talk-open/talk-closed/blink),
 * keyed by pose type. Missing poses are simply absent from the result — the
 * caller decides whether a partial set is renderable.
 */
export async function findCharacterAnimationPoseAssets(input: {
  workspaceId: string;
  characterId: string;
}) {
  const rows = await getDatabase()
    .select()
    .from(characterReferenceAssets)
    .where(
      and(
        eq(characterReferenceAssets.workspaceId, input.workspaceId),
        eq(characterReferenceAssets.characterId, input.characterId),
        inArray(characterReferenceAssets.type, ANIMATION_POSE_TYPES),
      ),
    );
  const byType = new Map(rows.map((row) => [row.type, row]));
  return {
    idle: byType.get("poseIdle") ?? null,
    talkOpen: byType.get("poseTalkOpen") ?? null,
    talkClosed: byType.get("poseTalkClosed") ?? null,
    blink: byType.get("poseBlink") ?? null,
  };
}
