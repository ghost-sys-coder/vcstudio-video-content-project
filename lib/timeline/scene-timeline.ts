/**
 * Deterministic project timeline service. Scene audio durations are
 * authoritative. All arithmetic is done in integer milliseconds and each frame
 * boundary is derived from an absolute millisecond value (never by accumulating
 * frame deltas), so there is no cumulative floating-point drift.
 */

export interface TimelineSceneInput {
  sceneId: string;
  sceneNumber: number;
  durationMilliseconds: number;
}

export interface TimelineScene {
  sceneId: string;
  sceneNumber: number;
  durationMilliseconds: number;
  startMilliseconds: number;
  endMilliseconds: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export interface ProjectTimeline {
  scenes: TimelineScene[];
  framesPerSecond: number;
  paddingMilliseconds: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
}

export function millisecondsToFrames(
  milliseconds: number,
  framesPerSecond: number,
): number {
  if (!Number.isInteger(milliseconds) || milliseconds < 0)
    throw new RangeError("Milliseconds must be a nonnegative integer.");
  if (!Number.isInteger(framesPerSecond) || framesPerSecond <= 0)
    throw new RangeError("Frames per second must be a positive integer.");
  // Integer arithmetic on an absolute value, rounded to the nearest frame.
  return Math.round((milliseconds * framesPerSecond) / 1000);
}

export function buildProjectTimeline(input: {
  scenes: TimelineSceneInput[];
  framesPerSecond: number;
  paddingMilliseconds: number;
}): ProjectTimeline {
  if (!Number.isInteger(input.framesPerSecond) || input.framesPerSecond <= 0)
    throw new RangeError("Frames per second must be a positive integer.");
  if (
    !Number.isInteger(input.paddingMilliseconds) ||
    input.paddingMilliseconds < 0
  )
    throw new RangeError("Padding milliseconds must be a nonnegative integer.");

  const ordered = [...input.scenes].sort(
    (left, right) => left.sceneNumber - right.sceneNumber,
  );

  const scenes: TimelineScene[] = [];
  let cursorMilliseconds = 0;
  ordered.forEach((scene, index) => {
    if (
      !Number.isInteger(scene.durationMilliseconds) ||
      scene.durationMilliseconds < 0
    )
      throw new RangeError(
        `Scene ${scene.sceneNumber} duration must be a nonnegative integer.`,
      );

    const startMilliseconds = cursorMilliseconds;
    const endMilliseconds = startMilliseconds + scene.durationMilliseconds;
    const startFrame = millisecondsToFrames(
      startMilliseconds,
      input.framesPerSecond,
    );
    const endFrame = millisecondsToFrames(
      endMilliseconds,
      input.framesPerSecond,
    );

    scenes.push({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      durationMilliseconds: scene.durationMilliseconds,
      startMilliseconds,
      endMilliseconds,
      startFrame,
      endFrame,
      durationFrames: endFrame - startFrame,
    });

    // Padding is inserted only between consecutive scenes, never trailing.
    cursorMilliseconds =
      endMilliseconds +
      (index < ordered.length - 1 ? input.paddingMilliseconds : 0);
  });

  const totalDurationMilliseconds =
    scenes.length > 0 ? scenes[scenes.length - 1]!.endMilliseconds : 0;

  return {
    scenes,
    framesPerSecond: input.framesPerSecond,
    paddingMilliseconds: input.paddingMilliseconds,
    totalDurationMilliseconds,
    totalFrames: millisecondsToFrames(
      totalDurationMilliseconds,
      input.framesPerSecond,
    ),
  };
}
