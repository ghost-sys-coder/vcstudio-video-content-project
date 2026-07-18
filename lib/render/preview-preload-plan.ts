/**
 * Pure planning for the preview player's rolling asset preload window.
 *
 * The preview never downloads the entire (potentially 11 minute) project before
 * playback: it preloads an initial window big enough to start smoothly, then
 * keeps a rolling window ahead of the playhead while discarding assets far
 * behind it. Keeping this logic pure and framework-free makes the windowing
 * deterministic and unit-testable, separate from the React/Remotion plumbing in
 * the hook that consumes it.
 */

import type { VideoCompositionScene } from "@/lib/render/video-composition-data";

export type PreviewAssetType = "image" | "audio";

export interface PreviewAsset {
  /** Stable per-asset key (`${sceneId}:${type}`), used for telemetry. */
  key: string;
  sceneId: string;
  sceneNumber: number;
  type: PreviewAssetType;
  /** The signed URL the media component references (prefetch cache key). */
  url: string;
  startSeconds: number;
  endSeconds: number;
}

/** Seconds of assets to fully preload before playback is allowed to start. */
export const INITIAL_PRELOAD_SECONDS = 25;
/** Seconds ahead of the playhead to keep prefetched during playback. */
export const AHEAD_PRELOAD_SECONDS = 30;
/** Seconds behind the playhead to retain before an asset may be freed. */
export const BEHIND_RETENTION_SECONDS = 5;

/**
 * Flattens the composition scenes into the ordered image + audio assets the
 * preview must load, each tagged with the wall-clock interval it is on screen
 * so the windowing math can compare against the current playback time.
 */
export function buildPreviewAssets(
  scenes: readonly VideoCompositionScene[],
  framesPerSecond: number,
): PreviewAsset[] {
  const fps = framesPerSecond > 0 ? framesPerSecond : 1;
  const assets: PreviewAsset[] = [];
  for (const scene of scenes) {
    const startSeconds = scene.startFrame / fps;
    const endSeconds = (scene.startFrame + scene.durationFrames) / fps;
    assets.push({
      key: `${scene.sceneId}:image`,
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      type: "image",
      url: scene.imageUrl,
      startSeconds,
      endSeconds,
    });
    assets.push({
      key: `${scene.sceneId}:audio`,
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      type: "audio",
      url: scene.audioUrl,
      startSeconds,
      endSeconds,
    });
  }
  return assets;
}

/**
 * The set of URLs that must be fully loaded before playback may begin: every
 * asset that starts within the initial window, plus the first scene's assets so
 * frame zero is always ready even when the first scene is longer than the
 * window.
 */
export function initialPreloadUrls(
  assets: readonly PreviewAsset[],
  windowSeconds: number = INITIAL_PRELOAD_SECONDS,
): Set<string> {
  const firstSceneId = assets[0]?.sceneId ?? null;
  const urls = new Set<string>();
  for (const asset of assets) {
    if (asset.startSeconds <= windowSeconds || asset.sceneId === firstSceneId)
      urls.add(asset.url);
  }
  return urls;
}

/**
 * The URLs that should be resident at a given playback time: any asset whose
 * on-screen interval overlaps the retention-to-ahead band around the playhead,
 * plus the first scene's assets which are always kept so looping back to the
 * start replays instantly. Anything else may be freed to bound memory.
 */
export function selectPreloadUrls(input: {
  assets: readonly PreviewAsset[];
  currentSeconds: number;
  aheadSeconds?: number;
  behindSeconds?: number;
}): Set<string> {
  const ahead = input.aheadSeconds ?? AHEAD_PRELOAD_SECONDS;
  const behind = input.behindSeconds ?? BEHIND_RETENTION_SECONDS;
  const windowStart = input.currentSeconds - behind;
  const windowEnd = input.currentSeconds + ahead;
  const firstSceneId = input.assets[0]?.sceneId ?? null;

  const urls = new Set<string>();
  for (const asset of input.assets) {
    const overlaps =
      asset.startSeconds <= windowEnd && asset.endSeconds >= windowStart;
    if (overlaps || asset.sceneId === firstSceneId) urls.add(asset.url);
  }
  return urls;
}
