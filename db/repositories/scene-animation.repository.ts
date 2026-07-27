import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  sceneAnimationDirections,
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
