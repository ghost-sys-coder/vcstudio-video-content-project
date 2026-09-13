/**
 * What merging two scenes costs, stated before it happens.
 *
 * A merge is unusual among this application's destructive actions in that most
 * of what it touches survives. The surviving scene keeps its brief and its
 * approved images, because nothing in the merge changes a visual field. What
 * does not survive is said plainly: the absorbed scene and everything it owns,
 * and both narration takes, since the merged scene speaks a passage neither
 * recording contains.
 */

export type SceneMergeTone = "neutral" | "caution";

export interface SceneMergeLine {
  tone: SceneMergeTone;
  text: string;
}

export interface SceneMergeSummary {
  title: string;
  lines: SceneMergeLine[];
  confirmLabel: string;
}

export interface SceneMergeDescription {
  survivorSceneNumber: number;
  absorbedSceneNumber: number;
  /** True when the absorbed scene has generated images or narration. */
  absorbedHasGeneratedWork: boolean;
  /** True when the surviving scene has approved images worth mentioning. */
  survivorHasApprovedImages: boolean;
  totalSceneCount: number;
}

export function describeSceneMerge(
  input: SceneMergeDescription,
): SceneMergeSummary {
  const resulting = Math.min(
    input.survivorSceneNumber,
    input.absorbedSceneNumber,
  );
  const earlier = resulting;
  const later = Math.max(input.survivorSceneNumber, input.absorbedSceneNumber);
  const lines: SceneMergeLine[] = [];

  lines.push({
    tone: "neutral",
    text: `Scene ${earlier}'s narration and scene ${later}'s are joined in that order, and the result becomes scene ${resulting}.`,
  });

  lines.push({
    tone: "neutral",
    text: input.survivorHasApprovedImages
      ? `Scene ${input.survivorSceneNumber} lives on. Its visual brief is untouched, so its approved image for each size is kept.`
      : `Scene ${input.survivorSceneNumber} lives on, keeping its visual brief unchanged.`,
  });

  lines.push({
    tone: "caution",
    text: input.absorbedHasGeneratedWork
      ? `Scene ${input.absorbedSceneNumber} is deleted. Its images, its narration audio and its stored files go with it, and that work was paid for.`
      : `Scene ${input.absorbedSceneNumber} is deleted.`,
  });

  // Said every time, because it is the one unavoidable cost and it is not
  // obvious: the merged scene speaks a passage neither recording contains, so
  // neither can be kept however little the text moved.
  lines.push({
    tone: "caution",
    text: "Narration audio is not kept for either scene. The merged scene needs one new take covering the whole passage, and that is the only generation a merge costs.",
  });

  lines.push({
    tone: "neutral",
    text: "Your approved script stays covered. These passages are already next to each other in it, so joining them leaves it narrated once and in order.",
  });

  lines.push({
    tone: "neutral",
    text: `The project will have ${input.totalSceneCount - 1} scenes afterwards, and later scenes move up by one.`,
  });

  return {
    title: `Merge scene ${input.absorbedSceneNumber} into scene ${input.survivorSceneNumber}?`,
    lines,
    confirmLabel: "Merge scenes",
  };
}
