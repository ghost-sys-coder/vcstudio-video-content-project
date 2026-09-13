/**
 * What merging two scenes produces, and when it must be refused.
 *
 * **Merging is only sound between neighbours, and that is the whole reason the
 * feature is cheap.** Scenes exist to reproduce the approved script contiguously
 * — that is the invariant the coverage checker enforces and the one that failed
 * loudly during analysis debugging. Two adjacent scenes carry two passages that
 * are already contiguous, so concatenating them yields a passage the script
 * still contains, in order, exactly once. Coverage survives by construction
 * rather than by an exception carved for merging. Between non-neighbours it
 * cannot, so that is refused rather than repaired.
 *
 * **One scene survives; it is not a blend.** The survivor keeps its identity,
 * its visual brief and therefore its approved images, because
 * `sceneMediaCompatibility` invalidates images only when a visual field
 * changes. Merging changes narration and duration, neither of which is one. So
 * a merge costs a narration take and nothing else — provided the brief is left
 * alone, which is why nothing here concatenates briefs or unions cast lists.
 * `characterNames` and `propNames` *are* visual fields, and combining them
 * would quietly destroy every image on the merged scene.
 */

export interface SceneMergeSide {
  sceneId: string;
  sceneNumber: number;
  currentVersion: number;
  narrationText: string;
  estimatedDurationMilliseconds: number;
  startTimeMilliseconds: number;
}

export type SceneMergeRefusalReason = "same_scene" | "not_adjacent";

export interface SceneMergePlan {
  survivor: SceneMergeSide;
  absorbed: SceneMergeSide;
  /** The lower of the two numbers, which is where the merged scene lands. */
  resultingSceneNumber: number;
  mergedNarrationText: string;
  mergedDurationMilliseconds: number;
  /** Where the merged scene starts, taken from the earlier of the two. */
  startTimeMilliseconds: number;
}

export type SceneMergeResult =
  | { ok: true; plan: SceneMergePlan }
  | { ok: false; reason: SceneMergeRefusalReason; message: string };

/**
 * Joins two passages the way the coverage walk reads them back.
 *
 * A single space, because the checker consumes one separator between scenes and
 * normalization collapses every whitespace run to exactly that. Each side is
 * trimmed first so a stored trailing newline cannot become a double space in
 * the merged narration a narrator will read.
 */
export function joinSceneNarration(earlier: string, later: string): string {
  return [earlier.trim(), later.trim()].filter(Boolean).join(" ");
}

export function planSceneMerge(input: {
  survivor: SceneMergeSide;
  absorbed: SceneMergeSide;
}): SceneMergeResult {
  const { survivor, absorbed } = input;

  if (survivor.sceneId === absorbed.sceneId)
    return {
      ok: false,
      reason: "same_scene",
      message: "A scene cannot be merged into itself.",
    };

  if (Math.abs(survivor.sceneNumber - absorbed.sceneNumber) !== 1)
    return {
      ok: false,
      reason: "not_adjacent",
      message:
        "Only neighbouring scenes can be merged. Merging scenes that are not side by side would leave the passage between them narrated twice or not at all.",
    };

  // Script order, not merge direction: the earlier scene's passage comes first
  // whichever of the two the creator chose to keep.
  const [earlier, later] =
    survivor.sceneNumber < absorbed.sceneNumber
      ? [survivor, absorbed]
      : [absorbed, survivor];

  return {
    ok: true,
    plan: {
      survivor,
      absorbed,
      resultingSceneNumber: earlier.sceneNumber,
      mergedNarrationText: joinSceneNarration(
        earlier.narrationText,
        later.narrationText,
      ),
      mergedDurationMilliseconds:
        survivor.estimatedDurationMilliseconds +
        absorbed.estimatedDurationMilliseconds,
      startTimeMilliseconds: earlier.startTimeMilliseconds,
    },
  };
}
