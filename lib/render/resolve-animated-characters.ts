import "server-only";

import {
  findCharacterAnimationPoseAssets,
  findSceneAnimationDirection,
} from "@/db/repositories/scene-animation.repository";
import type { VideoTimeline } from "@/lib/timeline/video-timeline";

export type AnimatedCharacterPoseObjectKeys = {
  idleObjectKey: string;
  talkOpenObjectKey: string;
  talkClosedObjectKey: string;
  blinkObjectKey: string;
};

/**
 * Looks up which scenes in a timeline are directed to use an animated
 * character, and resolves each to its four current pose object keys. A scene
 * whose character has an incomplete pose set (still mid-generation, or never
 * finished) is silently omitted here — the caller then falls back to that
 * scene's ordinary static image, rather than failing the whole render.
 */
export async function resolveAnimatedCharactersBySceneVersion(input: {
  workspaceId: string;
  timeline: VideoTimeline;
}): Promise<Readonly<Record<string, AnimatedCharacterPoseObjectKeys>>> {
  const result: Record<string, AnimatedCharacterPoseObjectKeys> = {};
  for (const scene of input.timeline.scenes) {
    const direction = await findSceneAnimationDirection({
      workspaceId: input.workspaceId,
      sceneVersionId: scene.sceneVersionId,
    });
    if (!direction) continue;
    const poses = await findCharacterAnimationPoseAssets({
      workspaceId: input.workspaceId,
      characterId: direction.characterId,
    });
    if (!poses.idle || !poses.talkOpen || !poses.talkClosed || !poses.blink)
      continue;
    result[scene.sceneVersionId] = {
      idleObjectKey: poses.idle.objectKey,
      talkOpenObjectKey: poses.talkOpen.objectKey,
      talkClosedObjectKey: poses.talkClosed.objectKey,
      blinkObjectKey: poses.blink.objectKey,
    };
  }
  return result;
}
