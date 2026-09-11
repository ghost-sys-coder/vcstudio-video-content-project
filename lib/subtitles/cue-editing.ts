/**
 * Adjusting, splitting and merging caption cues without ever producing a track
 * that cannot be rendered.
 *
 * **Every operation returns a refusal rather than a repaired result.** A caller
 * that drags a boundary past its neighbour has asked for something impossible,
 * and quietly clamping it to the nearest legal value would move a cue the
 * person did not touch. Refusing with the reason keeps the edit where it was
 * and says why it did not take.
 *
 * **Times are relative to the scene, not the project.** A correction says where
 * a phrase sits inside its own narration clip. Storing it against the project
 * timeline would break it the moment an earlier scene changed length, which is
 * precisely when corrections matter most.
 *
 * The invariants are the acceptance criterion in code: ordered, no negative
 * times, no overlap, nothing past the end of the narration, and nothing too
 * brief to read.
 */

export interface CaptionCue {
  text: string;
  /** Milliseconds from the start of this scene's narration. */
  startMilliseconds: number;
  endMilliseconds: number;
}

export type CueEditResult =
  { ok: true; cues: CaptionCue[] } | { ok: false; message: string };

export interface CueBounds {
  sceneDurationMilliseconds: number;
  minimumCueDurationMilliseconds: number;
}

/** The first broken invariant, in plain language, or `null` when the list is sound. */
export function findCueProblem(
  cues: readonly CaptionCue[],
  bounds: CueBounds,
): string | null {
  if (cues.length === 0) return null;
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!;
    if (!Number.isInteger(cue.startMilliseconds) || cue.startMilliseconds < 0)
      return `Line ${index + 1} starts before the narration does.`;
    if (!Number.isInteger(cue.endMilliseconds))
      return `Line ${index + 1} has no usable end time.`;
    if (cue.endMilliseconds <= cue.startMilliseconds)
      return `Line ${index + 1} ends before it starts.`;
    if (
      cue.endMilliseconds - cue.startMilliseconds <
      bounds.minimumCueDurationMilliseconds
    )
      return `Line ${index + 1} is too short to read. Lines need at least ${bounds.minimumCueDurationMilliseconds} milliseconds.`;
    if (cue.endMilliseconds > bounds.sceneDurationMilliseconds)
      return `Line ${index + 1} runs past the end of this scene's narration.`;
    if (cue.text.trim().length === 0) return `Line ${index + 1} has no text.`;
    const next = cues[index + 1];
    if (next && next.startMilliseconds < cue.endMilliseconds)
      return `Line ${index + 1} overlaps line ${index + 2}.`;
  }
  return null;
}

function settle(cues: CaptionCue[], bounds: CueBounds): CueEditResult {
  const problem = findCueProblem(cues, bounds);
  return problem ? { ok: false, message: problem } : { ok: true, cues };
}

/**
 * Moves one edge of one cue.
 *
 * Only the cue being edited changes. Pushing a neighbour out of the way would
 * silently retime a line somebody else had already corrected, so a move that
 * would need that is refused instead.
 */
export function adjustCueBoundary(input: {
  cues: readonly CaptionCue[];
  index: number;
  edge: "start" | "end";
  milliseconds: number;
  bounds: CueBounds;
}): CueEditResult {
  const cue = input.cues[input.index];
  if (!cue) return { ok: false, message: "That line no longer exists." };
  const milliseconds = Math.round(input.milliseconds);
  const updated = input.cues.map((entry, index) =>
    index === input.index
      ? {
          ...entry,
          startMilliseconds:
            input.edge === "start" ? milliseconds : entry.startMilliseconds,
          endMilliseconds:
            input.edge === "end" ? milliseconds : entry.endMilliseconds,
        }
      : { ...entry },
  );
  return settle(updated, input.bounds);
}

/**
 * Splits one cue in two at a character offset, dividing its time by the share
 * of characters on each side.
 *
 * The offset is pulled to the nearest space, because splitting inside a word
 * produces two cues neither of which can be read. Proportional division is the
 * same rule the estimated track already uses, so a split line is no less
 * accurate than the line it came from — and both halves can then be adjusted.
 */
export function splitCue(input: {
  cues: readonly CaptionCue[];
  index: number;
  atCharacter: number;
  bounds: CueBounds;
}): CueEditResult {
  const cue = input.cues[input.index];
  if (!cue) return { ok: false, message: "That line no longer exists." };

  const text = cue.text;
  const offset = nearestWordBoundary(text, input.atCharacter);
  const head = text.slice(0, offset).trim();
  const tail = text.slice(offset).trim();
  if (head.length === 0 || tail.length === 0)
    return {
      ok: false,
      message: "Pick a point with words on both sides of it.",
    };

  const duration = cue.endMilliseconds - cue.startMilliseconds;
  const headShare = head.length / (head.length + tail.length);
  const boundary = cue.startMilliseconds + Math.round(duration * headShare);

  const updated = [
    ...input.cues.slice(0, input.index).map((entry) => ({ ...entry })),
    {
      text: head,
      startMilliseconds: cue.startMilliseconds,
      endMilliseconds: boundary,
    },
    {
      text: tail,
      startMilliseconds: boundary,
      endMilliseconds: cue.endMilliseconds,
    },
    ...input.cues.slice(input.index + 1).map((entry) => ({ ...entry })),
  ];
  const problem = findCueProblem(updated, input.bounds);
  if (problem)
    return {
      ok: false,
      message: `Splitting here would leave a line too short to read. This line needs at least ${input.bounds.minimumCueDurationMilliseconds * 2} milliseconds to split.`,
    };
  return { ok: true, cues: updated };
}

/**
 * Joins a cue with the one after it, spanning from the first start to the
 * second end.
 *
 * The gap between them is absorbed, which is the intended result: two lines
 * merged into one should stay on screen across the pause that used to separate
 * them rather than blinking out in the middle.
 */
export function mergeCueWithNext(input: {
  cues: readonly CaptionCue[];
  index: number;
  bounds: CueBounds;
}): CueEditResult {
  const first = input.cues[input.index];
  const second = input.cues[input.index + 1];
  if (!first || !second)
    return { ok: false, message: "There is no line after this one to merge." };
  const merged: CaptionCue = {
    text: `${first.text.trim()} ${second.text.trim()}`.trim(),
    startMilliseconds: first.startMilliseconds,
    endMilliseconds: second.endMilliseconds,
  };
  const updated = [
    ...input.cues.slice(0, input.index).map((entry) => ({ ...entry })),
    merged,
    ...input.cues.slice(input.index + 2).map((entry) => ({ ...entry })),
  ];
  return settle(updated, input.bounds);
}

/** Replaces a cue's words, leaving its times exactly as they were. */
export function editCueText(input: {
  cues: readonly CaptionCue[];
  index: number;
  text: string;
  bounds: CueBounds;
}): CueEditResult {
  if (!input.cues[input.index])
    return { ok: false, message: "That line no longer exists." };
  const updated = input.cues.map((entry, index) =>
    index === input.index
      ? { ...entry, text: input.text.trim() }
      : { ...entry },
  );
  return settle(updated, input.bounds);
}

function nearestWordBoundary(text: string, offset: number): number {
  const clamped = Math.min(Math.max(Math.round(offset), 0), text.length);
  if (clamped === 0 || clamped === text.length) return clamped;
  if (/\s/u.test(text[clamped] ?? "")) return clamped;
  for (let distance = 1; distance <= text.length; distance += 1) {
    const before = clamped - distance;
    const after = clamped + distance;
    if (before > 0 && /\s/u.test(text[before] ?? "")) return before;
    if (after < text.length && /\s/u.test(text[after] ?? "")) return after;
  }
  return clamped;
}
