import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  characters,
  type Character,
  type CharacterReferenceType,
} from "@/db/schema";

export const ANIMATION_POSE_TYPES = [
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
] as const satisfies readonly CharacterReferenceType[];

// Reserved for the standalone Animated Videos feature (not yet built) — no
// current caller. Kept because it's generic character/workspace-scoped
// infrastructure with zero coupling to the (removed) per-scene animate
// picker, not because anything uses it today.

/**
 * Active characters that have all four pose stills generated — the only
 * characters eligible to drive an animated video, since a partial pose set
 * can't be rendered.
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
