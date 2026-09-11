import type { SubtitleGranularity } from "@/lib/subtitles/caption-style-data";
import { buildSceneTextChunks } from "@/lib/subtitles/subtitle-segmentation";
import { millisecondsToFrames } from "@/lib/timeline/scene-timeline";
import type { CaptionCue } from "@/lib/subtitles/cue-editing";
import {
  findSilenceWindows,
  snapBoundariesToPauses,
} from "@/lib/subtitles/pause-alignment";
import {
  summarizeTrackTimingSource,
  type CueTimingSource,
} from "@/lib/subtitles/cue-timing-source";

export interface SubtitleTrackSceneInput {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  narrationText: string;
  /** Absolute scene start in the project timeline, integer milliseconds. */
  startMilliseconds: number;
  /** Absolute scene end in the project timeline, integer milliseconds. */
  endMilliseconds: number;
  /**
   * The narration's measured loudness envelope, when one exists. Used only to
   * move line breaks onto real pauses; absent means the scene keeps the
   * estimate, which is the long-standing behaviour and is never relabelled.
   */
  audioEnvelope?: readonly number[] | null;
  envelopeSampleRateHz?: number | null;
  /**
   * Times a person set by hand for this scene, relative to its narration.
   * When present these win outright: a correction must not be re-derived by
   * the next thing that touches the track.
   */
  manualCues?: readonly CaptionCue[] | null;
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
  /** Where this cue's timing came from. Never claims more than was done. */
  timingSource: CueTimingSource;
}

export interface SubtitleTrack {
  granularity: SubtitleGranularity;
  framesPerSecond: number;
  segments: SubtitleSegment[];
  totalDurationMilliseconds: number;
  /** The weakest source present, so a mixed track never overstates itself. */
  timingSource: CueTimingSource;
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
 * Builds an ordered, non-overlapping subtitle track.
 *
 * Three ways a scene can be timed, in strict order of authority:
 *
 * 1. **Times a person set by hand** win outright. A correction that the next
 *    build quietly re-derived would be worthless.
 * 2. Otherwise each scene's known audio duration is distributed across its text
 *    chunks proportionally to character length, and the line breaks are then
 *    moved onto silences measured in the narration where one is close enough.
 * 3. With no envelope, or with no pause near a break, the proportional estimate
 *    stands unchanged. It is reported as estimated, never dressed up as more.
 *
 * Absolute timings are laid out with a forward cursor in every case, so a
 * segment can never start before the previous one ends.
 */
export function assembleSubtitleTrack(
  scenes: SubtitleTrackSceneInput[],
  options: SubtitleTrackOptions,
): SubtitleTrack {
  const overrides = options.textOverrides ?? {};
  const maxCaptionCharacters = Math.max(1, options.maxLineCharacters * 2);
  const segments: SubtitleSegment[] = [];

  const sceneSources: CueTimingSource[] = [];

  for (const scene of [...scenes].sort(
    (left, right) => left.sceneNumber - right.sceneNumber,
  )) {
    const sceneDuration = scene.endMilliseconds - scene.startMilliseconds;
    if (sceneDuration <= 0) continue;

    const placed = placeSceneCues(scene, sceneDuration, options, {
      maxCaptionCharacters,
    });
    if (placed.cues.length === 0) continue;
    sceneSources.push(placed.source);

    placed.cues.forEach((cue, index) => {
      const key = `${scene.sceneVersionId}:${index}`;
      // A hand-set cue already carries the corrected words; re-applying the
      // settings-level override on top would undo the correction.
      const overrideText =
        placed.source === "manual" ? undefined : overrides[key];
      const startMilliseconds = scene.startMilliseconds + cue.startMilliseconds;
      const endMilliseconds = scene.startMilliseconds + cue.endMilliseconds;
      segments.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        index,
        key,
        text:
          overrideText !== undefined && overrideText.trim().length > 0
            ? overrideText.trim()
            : cue.text,
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
        timingSource: placed.source,
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
    timingSource: summarizeTrackTimingSource(sceneSources),
  };
}

/**
 * One scene's cues, relative to its own narration, and where they came from.
 *
 * Kept separate from the absolute layout above because the three sources differ
 * only in how they produce these relative times; everything after is
 * identical for all of them.
 */
function placeSceneCues(
  scene: SubtitleTrackSceneInput,
  sceneDuration: number,
  options: SubtitleTrackOptions,
  derived: { maxCaptionCharacters: number },
): { cues: CaptionCue[]; source: CueTimingSource } {
  if (scene.manualCues && scene.manualCues.length > 0)
    return {
      cues: scene.manualCues.map((cue) => ({ ...cue })),
      source: "manual",
    };

  const chunks = buildSceneTextChunks({
    narrationText: scene.narrationText,
    granularity: options.granularity,
    maxCaptionCharacters: derived.maxCaptionCharacters,
  });
  if (chunks.length === 0) return { cues: [], source: "estimated" };

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
  // after merging, then express the result as interior boundaries.
  const mergedDurations = distributeInteger(
    sceneDuration,
    finalized.map((segment) => segment.weight),
  );
  const boundaries: number[] = [];
  let running = 0;
  for (let index = 0; index < finalized.length - 1; index += 1) {
    running += mergedDurations[index]!;
    boundaries.push(running);
  }

  let source: CueTimingSource = "estimated";
  let placedBoundaries = boundaries;
  const envelope = scene.audioEnvelope;
  const sampleRateHz = scene.envelopeSampleRateHz ?? 0;
  if (envelope && envelope.length > 0 && sampleRateHz > 0) {
    const snapped = snapBoundariesToPauses({
      boundaries,
      silences: findSilenceWindows({ envelope, sampleRateHz }),
      sceneDurationMilliseconds: sceneDuration,
      minimumCueDurationMilliseconds: options.minSegmentDurationMilliseconds,
    });
    placedBoundaries = snapped.boundaries;
    // Only claim an adjustment that actually happened.
    if (snapped.movedCount > 0) source = "pause_adjusted";
  }

  const edges = [0, ...placedBoundaries, sceneDuration];
  const cues = finalized.map((segment, index) => ({
    text: segment.text,
    startMilliseconds: edges[index]!,
    endMilliseconds: edges[index + 1]!,
  }));
  return { cues, source };
}
