/**
 * What has to happen to each scene before a project can be rendered in another
 * shape.
 *
 * Pure, and separate from the work itself, because this decides what gets
 * spent. Reframing a landscape video to vertical extends each still with a paid
 * image generation, so the total has to be knowable, reviewable and refusable
 * before a single request goes out. Deciding and doing in one pass would mean
 * the first scene is already paid for by the time anyone sees the bill.
 */

export type ReframeSceneAction =
  /** An approved image already exists at the target's own size. */
  | "native"
  /** A usable extended image already exists from an earlier run. */
  | "reuse"
  /** Extend the approved still onto the taller or wider canvas. Paid. */
  | "extend"
  /** Crop the approved still. Free, and lossy. */
  | "crop"
  /** Nothing approved to work from. */
  | "blocked";

export interface ReframeSceneInput {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  /** The scene's approved still at the project's own size. */
  approvedImage: {
    generationId: string;
    /** Only an AI-generated still can be extended; an upload has no prompt. */
    source: "ai_generated" | "user_uploaded";
  } | null;
  /** An approved still already at the target's native size. */
  hasNativeImage: boolean;
  /** An extended still produced for this target by an earlier run. */
  existingVariantImage: {
    generationId: string;
    sourceImageGenerationId: string;
    status: "succeeded" | "running" | "queued" | "pending" | "failed";
    /**
     * False when the extension was made by a superseded prompt version.
     *
     * This is not pedantry about versions. `scene-outpaint-v1` told the model
     * it was filling a 9:16 frame when the canvas it actually produced was
     * 2:3, so it composed across a width the renderer then cropped, and every
     * video made that way lost picture down both sides. Reusing one of those
     * would reproduce exactly the defect the person clicked the button to fix.
     */
    matchesCurrentPrompt: boolean;
  } | null;
}

export interface ReframeScenePlan {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  action: ReframeSceneAction;
  /** The still to extend. Present only for `extend`. */
  sourceGenerationId: string | null;
  /** Stated in the interface, so a cropped or blocked scene is never silent. */
  reason: string;
}

export interface ReframePlan {
  scenes: ReframeScenePlan[];
  /** Scenes needing a paid extension. The only ones that cost anything. */
  extendCount: number;
  /** Scenes that will be cropped because they cannot be extended. */
  cropCount: number;
  /** Scenes already covered, by a native still or an earlier extension. */
  readyCount: number;
  /** Scenes with nothing approved. Any of these blocks the whole job. */
  blockedCount: number;
}

export function planReframe(scenes: ReframeSceneInput[]): ReframePlan {
  const planned = scenes.map((scene): ReframeScenePlan => {
    if (!scene.approvedImage)
      return {
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        action: "blocked",
        sourceGenerationId: null,
        reason: "This scene has no approved image.",
      };

    if (scene.hasNativeImage)
      return {
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        action: "native",
        sourceGenerationId: null,
        reason:
          "Already has an approved image at this size, so nothing will be generated.",
      };

    // Only an extension descended from the *currently* approved still counts,
    // and only one made by the current prompt. An extension from an image
    // since replaced would quietly render the old picture; one from a
    // superseded prompt would reproduce the composition defect that prompt
    // caused. Both are worse than paying to extend again.
    const existing = scene.existingVariantImage;
    if (
      existing &&
      existing.status === "succeeded" &&
      existing.matchesCurrentPrompt &&
      existing.sourceImageGenerationId === scene.approvedImage.generationId
    )
      return {
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        action: "reuse",
        sourceGenerationId: scene.approvedImage.generationId,
        reason: "Already extended for this shape.",
      };

    if (scene.approvedImage.source !== "ai_generated")
      return {
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: scene.sceneVersionId,
        action: "crop",
        sourceGenerationId: scene.approvedImage.generationId,
        reason:
          "This image was uploaded, so it cannot be extended. It will be cropped instead.",
      };

    return {
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      sceneVersionId: scene.sceneVersionId,
      action: "extend",
      sourceGenerationId: scene.approvedImage.generationId,
      reason:
        existing &&
        existing.status === "succeeded" &&
        !existing.matchesCurrentPrompt
          ? "An earlier extension exists but was composed for the wrong canvas, so it will be remade."
          : "Will be extended onto the new canvas.",
    };
  });

  const count = (action: ReframeSceneAction) =>
    planned.filter((scene) => scene.action === action).length;

  return {
    scenes: planned,
    extendCount: count("extend"),
    cropCount: count("crop"),
    readyCount: count("native") + count("reuse"),
    blockedCount: count("blocked"),
  };
}
