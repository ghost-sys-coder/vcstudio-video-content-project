/**
 * What deleting a scene actually costs, stated before it happens.
 *
 * Deleting a scene is not like deleting a draft. The scene carries paid work:
 * generated images, synthesised narration, perhaps a clip, and none of it comes
 * back. It also leaves the approved script partly uncovered, because the script
 * is the thing the scenes were made to reproduce and one of them is now gone.
 *
 * Both facts are said plainly rather than discovered afterwards. The second in
 * particular is not a fault to be hidden: the alternative would be editing the
 * creator's approved script on their behalf, which is a far worse thing to do
 * quietly.
 */

export type SceneDeletionTone = "neutral" | "caution";

export interface SceneDeletionLine {
  tone: SceneDeletionTone;
  text: string;
}

export interface SceneDeletionSummary {
  title: string;
  lines: SceneDeletionLine[];
  confirmLabel: string;
  /** False when there is nothing to delete. */
  canDelete: boolean;
}

export interface SceneDeletionInput {
  sceneNumber: number;
  totalSceneCount: number;
  /**
   * True when anything was generated for this scene: an image, narration, a
   * clip. Deliberately one flag rather than a count of each, because the
   * storyboard knows whether a scene has work without knowing how much, and a
   * precise number this layer cannot substantiate would be worse than an
   * honest general statement.
   */
  hasGeneratedWork: boolean;
  /** True when the project's script was approved and is covered by scenes. */
  coversApprovedScript: boolean;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function describeSceneDeletion(
  input: SceneDeletionInput,
): SceneDeletionSummary {
  const lines: SceneDeletionLine[] = [];
  const following = input.totalSceneCount - input.sceneNumber;

  if (following > 0)
    lines.push({
      tone: "neutral",
      text: `${plural(following, "scene", "scenes")} after this one will be renumbered, so scene ${input.sceneNumber + 1} becomes scene ${input.sceneNumber}.`,
    });

  if (input.hasGeneratedWork)
    lines.push({
      tone: "caution",
      text: "Everything generated for this scene goes with it: its images, its narration audio and any clip. That work was paid for and cannot be recovered.",
    });

  if (input.coversApprovedScript)
    lines.push({
      tone: "caution",
      // Said out loud because the alternative is editing their approved script
      // for them, which is worse.
      text: "The passage this scene narrates will no longer be covered by any scene. Your approved script is not changed, so the coverage panel will show the gap until you fill it or re-approve a shorter script.",
    });

  lines.push({
    tone: "neutral",
    text:
      input.totalSceneCount === 1
        ? "This is the only scene, so the project will have none left."
        : `The project will have ${input.totalSceneCount - 1} scenes afterwards.`,
  });

  return {
    title: `Delete scene ${input.sceneNumber}?`,
    lines,
    confirmLabel: "Delete scene",
    canDelete: input.totalSceneCount > 0,
  };
}
