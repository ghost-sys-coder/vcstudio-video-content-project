import type { SubtitleGranularity } from "@/lib/subtitles/caption-style-data";
import { buildSceneTextChunks } from "@/lib/subtitles/subtitle-segmentation";
import { millisecondsToFrames } from "@/lib/timeline/scene-timeline";

export interface SubtitleTrackSceneInput {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  narrationText: string;
  /** Absolute scene start in the project timeline, integer milliseconds. */
  startMilliseconds: number;
  /** Absolute scene end in the project timeline, integer milliseconds. */
  endMilliseconds: number;
}

export interface SubtitleSegment {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  /** Zero-based index within the scene; stable for a given narration. */
  index: number;
  /** `${sceneVersionId}:${index}`, the text-override lookup key. */
  key: string;
  text: string;
  startMilliseconds: number;
  endMilliseconds: number;
  startFrame: number;
  endFrame: number;
}

export interface SubtitleTrack {
  granularity: SubtitleGranularity;
  framesPerSecond: number;
  segments: SubtitleSegment[];
  totalDurationMilliseconds: number;
}

export interface SubtitleTrackOptions {
  granularity: SubtitleGranularity;
  framesPerSecond: number;
  /** Wrap target for readability and for splitting long sentences. */
  maxLineCharacters: number;
  /** Segments below this duration are merged into a neighbor when possible. */
  minSegmentDurationMilliseconds: number;
  /** `${sceneVersionId}:${index}` → replacement text. */
  textOverrides?: Readonly<Record<string, string>>;
}

interface PendingSegment {
  text: string;
  weight: number;
  durationMilliseconds: number;
}

/**
 * Largest-remainder distribution of an integer total across weights, so the
 * allocated parts sum to exactly `total` with no rounding drift.
 */
function distributeInteger(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (total * weight) / totalWeight);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) =>
      right.fraction === left.fraction
        ? left.index - right.index
        : right.fraction - left.fraction,
    );

  const result = [...floors];
  for (
    let position = 0;
    position < order.length && remainder > 0;
    position += 1
  ) {
    result[order[position]!.index] += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * Merges segments shorter than the minimum duration into an adjacent segment,
 * preserving text order. Leaves a lone segment untouched even if it is short.
 */
function mergeShortSegments(
  segments: PendingSegment[],
  minDurationMilliseconds: number,
): PendingSegment[] {
  const merged: PendingSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous && previous.durationMilliseconds < minDurationMilliseconds) {
      previous.text = `${previous.text} ${segment.text}`.trim();
      previous.weight += segment.weight;
      previous.durationMilliseconds += segment.durationMilliseconds;
    } else {
      merged.push({ ...segment });
    }
  }
  while (
    merged.length > 1 &&
    merged[merged.length - 1]!.durationMilliseconds < minDurationMilliseconds
  ) {
    const last = merged.pop()!;
    const previous = merged[merged.length - 1]!;
    previous.text = `${previous.text} ${last.text}`.trim();
    previous.weight += last.weight;
    previous.durationMilliseconds += last.durationMilliseconds;
  }
  return merged;
}

/**
 * Builds an ordered, non-overlapping subtitle track. Each scene's known audio
 * duration is distributed across its text chunks proportionally to their
 * character length; absolute timings are laid out with a forward cursor so a
 * segment can never start before the previous one ends.
 */
export function assembleSubtitleTrack(
  scenes: SubtitleTrackSceneInput[],
  options: SubtitleTrackOptions,
): SubtitleTrack {
  const overrides = options.textOverrides ?? {};
  const maxCaptionCharacters = Math.max(1, options.maxLineCharacters * 2);
  const segments: SubtitleSegment[] = [];

  for (const scene of [...scenes].sort(
    (left, right) => left.sceneNumber - right.sceneNumber,
  )) {
    const sceneDuration = scene.endMilliseconds - scene.startMilliseconds;
    if (sceneDuration <= 0) continue;

    const chunks = buildSceneTextChunks({
      narrationText: scene.narrationText,
      granularity: options.granularity,
      maxCaptionCharacters,
    });
    if (chunks.length === 0) continue;

    const weights = chunks.map((chunk) => Math.max(1, chunk.length));
    const durations = distributeInteger(sceneDuration, weights);
    const pending: PendingSegment[] = chunks.map((chunk, index) => ({
      text: chunk,
      weight: weights[index]!,
      durationMilliseconds: durations[index]!,
    }));

    const finalized = mergeShortSegments(
      pending,
      options.minSegmentDurationMilliseconds,
    );

    // Re-normalize durations so they still sum exactly to the scene duration
    // after merging, then lay out absolute times with a monotonic cursor.
    const mergedDurations = distributeInteger(
      sceneDuration,
      finalized.map((segment) => segment.weight),
    );

    let cursor = scene.startMilliseconds;
    finalized.forEach((segment, index) => {
      const isLast = index === finalized.length - 1;
      const startMilliseconds = cursor;
      const endMilliseconds = isLast
        ? scene.endMilliseconds
        : startMilliseconds + mergedDurations[index]!;
      cursor = endMilliseconds;

      const key = `${scene.sceneVersionId}:${index}`;
      const overrideText = overrides[key];
      segments.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        index,
        key,
        text:
          overrideText !== undefined && overrideText.trim().length > 0
            ? overrideText.trim()
            : segment.text,
        startMilliseconds,
        endMilliseconds,
        startFrame: millisecondsToFrames(
          startMilliseconds,
          options.framesPerSecond,
        ),
        endFrame: millisecondsToFrames(
          endMilliseconds,
          options.framesPerSecond,
        ),
      });
    });
  }

  const totalDurationMilliseconds =
    segments.length > 0 ? segments[segments.length - 1]!.endMilliseconds : 0;

  return {
    granularity: options.granularity,
    framesPerSecond: options.framesPerSecond,
    segments,
    totalDurationMilliseconds,
  };
}
