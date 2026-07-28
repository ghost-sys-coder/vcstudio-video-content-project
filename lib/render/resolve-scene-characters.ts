import "server-only";

import type { RenderSceneCharacterData } from "@/lib/render/render-timeline-snapshot";
import { listSceneVersionCharacters } from "@/db/repositories/characters.repository";
import { findCharacterAnimationPoseAssets } from "@/db/repositories/character-pose.repository";

/**
 * Resolves, per scene version, the animated characters to draw over that
 * scene's background plate.
 *
 * A character is skipped when its pose set is incomplete: all four stills are
 * required to animate, and a partial set would pop between a present and a
 * missing image. Skipping keeps the render honest — the scene still renders,
 * just without that character — rather than failing the whole video for one
 * half-generated character.
 */
export async function resolveSceneCharactersBySceneVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}): Promise<Map<string, RenderSceneCharacterData[]>> {
  const bySceneVersion = new Map<string, RenderSceneCharacterData[]>();
  if (!input.sceneVersionIds.length) return bySceneVersion;

  const assignments = await listSceneVersionCharacters({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneVersionIds: input.sceneVersionIds,
  });
  if (!assignments.length) return bySceneVersion;

  // One lookup per distinct character rather than per assignment: the same
  // character usually appears in most scenes of a video.
  const uniqueCharacterIds = [
    ...new Set(assignments.map((item) => item.character.id)),
  ];
  const poseSets = new Map(
    await Promise.all(
      uniqueCharacterIds.map(
        async (characterId) =>
          [
            characterId,
            await findCharacterAnimationPoseAssets({
              workspaceId: input.workspaceId,
              characterId,
            }),
          ] as const,
      ),
    ),
  );

  for (const item of assignments) {
    const poses = poseSets.get(item.character.id);
    if (!poses?.idle || !poses.talkOpen || !poses.talkClosed || !poses.blink)
      continue;

    const existing = bySceneVersion.get(item.assignment.sceneVersionId) ?? [];
    existing.push({
      characterId: item.character.id,
      name: item.character.name,
      stageSlot: item.assignment.stageSlot,
      isSpeaker: item.assignment.isSpeaker,
      poses: {
        idle: poses.idle.objectKey,
        talkOpen: poses.talkOpen.objectKey,
        talkClosed: poses.talkClosed.objectKey,
        blink: poses.blink.objectKey,
      },
    });
    bySceneVersion.set(item.assignment.sceneVersionId, existing);
  }
  return bySceneVersion;
}
