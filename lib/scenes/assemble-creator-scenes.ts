import type { SceneAnalysisSegmentHint } from "@studio/prompts";
import { normalizeNarrationText } from "@/lib/domain/narration-normalization";
import type { SceneAnalysisOutput } from "@/lib/schemas/scene";

export interface CreatorSceneAssembly {
  output: SceneAnalysisOutput;
  /** How many scenes the model had already reproduced exactly. */
  exactFromModel: number;
  /** How many narrations this replaced because the model's drifted. */
  repaired: number;
}

/**
 * Puts the creator's own narration back into the model's scene plan.
 *
 * When a creator's script already states its segments, we know the exact words
 * of every scene before the model is called. Asking the model to echo those
 * words back and then rejecting the whole run when a single character differs
 * makes a known quantity depend on a stochastic one. It is also what produced
 * the failure this exists to prevent: a rejected plan, a paid repair attempt,
 * and on the retry a model that reproduced "[VISUAL] Fast-paced..." as spoken
 * narration because it had been told the raw document was the script.
 *
 * So the model is used only for what it is needed for, the visual and camera
 * interpretation, and the narration is taken from the creator. Fidelity then
 * holds by construction rather than by hope.
 *
 * Returns null when the plan cannot be mapped to the creator's segments, in
 * which case the caller keeps its ordinary validate-and-repair behaviour. The
 * count must match exactly: the prompt states the segmentation is fixed, so a
 * different number of scenes means the model did not follow it and its scenes
 * cannot be paired with the creator's by position.
 */
export function assembleScenesFromCreatorSegments(input: {
  output: SceneAnalysisOutput;
  segments: SceneAnalysisSegmentHint[];
}): CreatorSceneAssembly | null {
  if (input.segments.length === 0) return null;
  if (input.output.scenes.length !== input.segments.length) return null;

  let exactFromModel = 0;
  const scenes = input.output.scenes.map((scene, index) => {
    const narration = input.segments[index]?.narration ?? scene.narrationText;
    if (
      normalizeNarrationText(scene.narrationText) ===
      normalizeNarrationText(narration)
    )
      exactFromModel += 1;
    return { ...scene, narrationText: narration };
  });

  return {
    output: { scenes },
    exactFromModel,
    repaired: scenes.length - exactFromModel,
  };
}
