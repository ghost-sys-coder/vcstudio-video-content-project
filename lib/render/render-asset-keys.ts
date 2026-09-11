import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";

/**
 * Every stored object a snapshot needs signed before it can be rendered.
 *
 * Extracted because the preview and the render worker each built this list
 * themselves, and the two had to agree exactly. A key missing from one of them
 * produces a render that is wrong in a way nothing reports: the composition
 * throws on a missing URL at best, and at worst an asset silently does not
 * appear. Adding a new kind of asset should be one edit, not two.
 *
 * Duplicates are removed, because a scene reusing one still for several shots
 * is ordinary and signing the same key twice is wasted work.
 */
export function collectRenderAssetObjectKeys(
  snapshot: RenderTimelineSnapshot,
): string[] {
  const keys = new Set<string>();
  // The sound bed plays under every scene, so it belongs to the snapshot
  // rather than to any one scene.
  if (snapshot.backgroundAudio) keys.add(snapshot.backgroundAudio.objectKey);
  for (const scene of snapshot.scenes) {
    keys.add(scene.image.objectKey);
    keys.add(scene.audio.objectKey);
    // Present only on multi-image scenes. The first shot repeats
    // `scene.image`, which the set collapses.
    for (const shot of scene.shots ?? []) keys.add(shot.objectKey);
    // Animated scenes also need their four pose stills; absent for
    // static-image projects.
    for (const character of scene.characters ?? []) {
      keys.add(character.poses.idle);
      keys.add(character.poses.talkOpen);
      keys.add(character.poses.talkClosed);
      keys.add(character.poses.blink);
    }
  }
  return [...keys];
}
