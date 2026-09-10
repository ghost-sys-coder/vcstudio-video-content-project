import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";

/**
 * How a caption should be drawn on one frame of its life.
 *
 * Offsets are a percentage of the caption's own box, so the travel scales with
 * the font size instead of being a fixed pixel distance that looks large on a
 * Short and invisible on a 16:9 render.
 */
export interface CaptionAnimationFrame {
  opacity: number;
  translateXPercent: number;
  translateYPercent: number;
}

export const CAPTION_SLIDE_DISTANCE_PERCENT = 45;

const STATIC_FRAME: CaptionAnimationFrame = {
  opacity: 1,
  translateXPercent: 0,
  translateYPercent: 0,
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Smooth start and end, so a short caption never appears to snap. */
function ease(progress: number): number {
  const t = clamp01(progress);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** The offset a cue travels from, in percent of its own box. */
function offsetFor(direction: CaptionStyleData["entranceDirection"]): {
  x: number;
  y: number;
} {
  if (direction === "top") return { x: 0, y: -CAPTION_SLIDE_DISTANCE_PERCENT };
  if (direction === "bottom")
    return { x: 0, y: CAPTION_SLIDE_DISTANCE_PERCENT };
  if (direction === "left") return { x: -CAPTION_SLIDE_DISTANCE_PERCENT, y: 0 };
  return { x: CAPTION_SLIDE_DISTANCE_PERCENT, y: 0 };
}

/**
 * Splits the cue's frames between arriving and leaving.
 *
 * The guard that matters: a cue shorter than its own animation must never begin
 * leaving before it has finished arriving, which would make it flicker without
 * ever being fully readable. Each phase is therefore capped at half the cue, so
 * a very brief caption gets a proportionally quicker movement rather than a
 * broken one.
 */
export function resolveCaptionAnimationFrames(input: {
  entranceDurationMilliseconds: number;
  exitMatchesEntrance: boolean;
  cueFrames: number;
  fps: number;
}): { entranceFrames: number; exitFrames: number } {
  if (input.fps <= 0 || input.cueFrames <= 0)
    return { entranceFrames: 0, exitFrames: 0 };
  const requested = Math.round(
    (input.entranceDurationMilliseconds / 1000) * input.fps,
  );
  const half = Math.floor(input.cueFrames / 2);
  const entranceFrames = Math.max(0, Math.min(requested, half));
  return {
    entranceFrames,
    exitFrames: input.exitMatchesEntrance ? entranceFrames : 0,
  };
}

/**
 * The opacity and offset for one frame of one cue.
 *
 * Pure, so the renderer stays a thin drawing layer and this behaviour can be
 * asserted without rendering a video.
 */
export function resolveCaptionAnimation(input: {
  style: Pick<
    CaptionStyleData,
    | "entranceEffect"
    | "entranceDirection"
    | "entranceDurationMilliseconds"
    | "exitMatchesEntrance"
  >;
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
}): CaptionAnimationFrame {
  if (input.style.entranceEffect === "none") return STATIC_FRAME;

  const cueFrames = input.endFrame - input.startFrame;
  const { entranceFrames, exitFrames } = resolveCaptionAnimationFrames({
    entranceDurationMilliseconds: input.style.entranceDurationMilliseconds,
    exitMatchesEntrance: input.style.exitMatchesEntrance,
    cueFrames,
    fps: input.fps,
  });
  if (entranceFrames === 0 && exitFrames === 0) return STATIC_FRAME;

  const elapsed = input.frame - input.startFrame;
  const remaining = input.endFrame - input.frame;

  const entering = entranceFrames > 0 ? ease(elapsed / entranceFrames) : 1;
  const leaving = exitFrames > 0 ? ease(remaining / exitFrames) : 1;
  // Whichever phase is further from settled wins, so the two never fight.
  const progress = clamp01(Math.min(entering, leaving));

  if (input.style.entranceEffect === "fade")
    return { opacity: progress, translateXPercent: 0, translateYPercent: 0 };

  const offset = offsetFor(input.style.entranceDirection);
  const travel = 1 - progress;
  return {
    opacity: progress,
    translateXPercent: offset.x * travel,
    translateYPercent: offset.y * travel,
  };
}
