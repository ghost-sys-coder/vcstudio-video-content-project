/**
 * Whether saving a scene edit is worth stopping the creator for, and what to
 * say if it is.
 *
 * Saving a scene has always been free and has never approved anything — it
 * writes a new version and returns the scene to review. What it *can* do is
 * invalidate media that was already generated and paid for, because an image
 * drawn from the old narration is no longer an image of this scene.
 *
 * So the question is not "is this an edit?" but "does this edit destroy
 * something?". When it destroys nothing, asking is pure friction and the save
 * should simply happen. When it destroys something, the cost belongs on screen
 * before the click that causes it, not in a surprise afterwards.
 */

import { formatUsdCents } from "@/lib/format/currency";
import type { SceneRevisionEstimateView } from "@/lib/scenes/scene-revision-view";

export interface SceneSaveImpactSummary {
  /** True when this edit invalidates media that already exists. */
  needsConfirmation: boolean;
  title: string;
  /** The consequence, in one sentence, before any itemised estimate. */
  lead: string;
  confirmLabel: string;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function describeSceneSaveImpact(
  estimate: SceneRevisionEstimateView,
): SceneSaveImpactSummary {
  if (estimate.affectedMediaCount === 0)
    return {
      needsConfirmation: false,
      title: "Save this edit?",
      lead: "Nothing generated for this scene is affected by this edit.",
      confirmLabel: "Save changes",
    };

  const affected = plural(
    estimate.affectedMediaCount,
    "finished asset",
    "finished assets",
  );

  // The money is stated only when it is actually known. An uploaded image or a
  // recorded voice-over is destroyed just the same and cannot be priced, and
  // "$0.00" next to that would read as "this costs you nothing", which is the
  // opposite of true.
  const cost =
    estimate.unavailableCount > 0
      ? estimate.estimatedCostCents > 0
        ? ` Replacing them costs at least ${formatUsdCents(estimate.estimatedCostCents)}; some of it cannot be priced here.`
        : " Replacing them cannot be priced here."
      : ` Generating them again would cost about ${formatUsdCents(estimate.estimatedCostCents)}.`;

  return {
    needsConfirmation: true,
    title: "This edit replaces finished work",
    lead: `Saving returns this scene to review and leaves ${affected} no longer matching it.${cost}`,
    // Saving genuinely spends nothing — it only starts no generation. A label
    // promising to spend would be a lie, so the money stays in the body text.
    confirmLabel: "Save anyway",
  };
}

/**
 * The standing line above the save button, before anything is clicked.
 *
 * It says out loud that saving does not approve, because the scene form's only
 * prominent action used to be "Approve scene" and the save control did not say
 * "save" until after it had been pressed once — which is exactly how a creator
 * concludes there is no way to keep an edit without approving it.
 */
export function describeSceneSaveState(input: {
  dirty: boolean;
  /** False when this edit invalidates the scene's approved images. */
  keepsImages: boolean;
  /** False when this edit invalidates the scene's approved narration. */
  keepsNarration: boolean;
}): string {
  if (!input.dirty)
    return "No changes to save. Existing approvals and media are kept.";

  return [
    "Saving records a new version and returns this scene to review; it does not approve it.",
    input.keepsImages
      ? "Approved images and framing are kept."
      : "Images and framing need preparing again.",
    input.keepsNarration
      ? "Approved narration and caption edits are kept."
      : "Narration and captions need preparing again.",
    "Other scenes keep their media. Saving is free and starts no generation.",
  ].join(" ");
}
