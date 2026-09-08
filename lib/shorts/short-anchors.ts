import type { VideoTimeline } from "@/lib/timeline/video-timeline";
import type { ShortClipDefinition } from "./short-timeline";
import { shortNeedsRangeReview } from "./short-revision-safety";

export interface ShortClipAnchor {
  sourceAudioGenerationIdSnapshot?: string | null;
  sourceStartOffsetMilliseconds?: number | null;
  sourceEndOffsetMilliseconds?: number | null;
}

/** Capture anchors only from the server's validated, approved source timeline. */
export function anchorShortClips<T extends ShortClipDefinition>(
  clips: T[],
  source: VideoTimeline,
) {
  return clips.map((clip) => {
    const scene = source.scenes.find(
      (row) =>
        row.sceneId === clip.sourceSceneId &&
        row.sceneVersionId === clip.sourceSceneVersionId,
    );
    if (
      !scene ||
      clip.sourceStartMilliseconds < scene.startMilliseconds ||
      clip.sourceEndMilliseconds > scene.endMilliseconds ||
      clip.sourceEndMilliseconds <= clip.sourceStartMilliseconds
    )
      throw new RangeError("Review this Short's source ranges before saving.");
    return {
      ...clip,
      sourceAudioGenerationIdSnapshot: scene.audio.generationId,
      sourceStartOffsetMilliseconds:
        clip.sourceStartMilliseconds - scene.startMilliseconds,
      sourceEndOffsetMilliseconds:
        clip.sourceEndMilliseconds - scene.startMilliseconds,
    };
  });
}

/** Read-time projection keeps saved trims and historical render snapshots immutable. */
export function resolveShortClips<
  T extends ShortClipAnchor & {
    sourceSceneId: string;
    sourceSceneVersionId: string;
    sourceStartMilliseconds: number;
    sourceEndMilliseconds: number;
    createdAt: Date;
  },
>(
  clips: T[],
  source: VideoTimeline,
  currentScenes: Parameters<typeof shortNeedsRangeReview>[1],
): { clips: T[]; needsReview: boolean } {
  let needsReview = false;
  const resolved = clips.map((clip) => {
    if (
      clip.sourceAudioGenerationIdSnapshot == null ||
      clip.sourceStartOffsetMilliseconds == null ||
      clip.sourceEndOffsetMilliseconds == null
    ) {
      needsReview ||= shortNeedsRangeReview([clip], currentScenes);
      if (
        clip.sourceAudioGenerationIdSnapshot != null ||
        clip.sourceStartOffsetMilliseconds != null ||
        clip.sourceEndOffsetMilliseconds != null
      ) {
        needsReview = true;
        return clip;
      }
      const scene = source.scenes.find(
        (row) =>
          row.sceneId === clip.sourceSceneId &&
          row.sceneVersionId === clip.sourceSceneVersionId,
      );
      needsReview ||=
        !scene ||
        clip.sourceStartMilliseconds < scene.startMilliseconds ||
        clip.sourceEndMilliseconds > scene.endMilliseconds ||
        clip.sourceEndMilliseconds <= clip.sourceStartMilliseconds;
      return clip;
    }
    const scene = source.scenes.find(
      (row) => row.sceneId === clip.sourceSceneId,
    );
    if (
      !scene ||
      scene.audio.generationId !== clip.sourceAudioGenerationIdSnapshot ||
      clip.sourceStartOffsetMilliseconds < 0 ||
      clip.sourceEndOffsetMilliseconds <= clip.sourceStartOffsetMilliseconds ||
      clip.sourceEndOffsetMilliseconds >
        scene.endMilliseconds - scene.startMilliseconds
    ) {
      needsReview = true;
      return clip;
    }
    return {
      ...clip,
      sourceSceneVersionId: scene.sceneVersionId,
      sourceStartMilliseconds:
        scene.startMilliseconds + clip.sourceStartOffsetMilliseconds,
      sourceEndMilliseconds:
        scene.startMilliseconds + clip.sourceEndOffsetMilliseconds,
    };
  });
  return { clips: resolved, needsReview };
}
