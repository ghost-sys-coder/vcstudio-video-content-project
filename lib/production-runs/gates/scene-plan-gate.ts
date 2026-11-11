import {
  combineGateResults,
  fail,
  pass,
  warn,
  type GateResult,
} from "@/lib/production-runs/gates/gate-result";

export interface ScenePlanGateScene {
  sceneNumber: number;
  narrationText: string;
  visualDescription: string;
}

/**
 * Whether an analysed scene plan is fit to be approved unseen.
 *
 * Script-to-scene fidelity is already enforced when the plan is created, so
 * this gate does not repeat it. It checks the things fidelity does not: that
 * every scene has narration and a visual to draw, and that no scene is so
 * long that one still would sit on screen past the point a viewer tolerates.
 */
export function evaluateScenePlanGate(input: {
  scenes: ScenePlanGateScene[];
  maximumScenes: number;
}): GateResult {
  if (input.scenes.length === 0)
    return fail(["The analysis produced no scenes."]);
  if (input.scenes.length > input.maximumScenes)
    return fail([
      `The plan has ${input.scenes.length} scenes; the project limit is ${input.maximumScenes}.`,
    ]);

  const results: GateResult[] = [];
  for (const scene of input.scenes) {
    if (scene.narrationText.trim() === "")
      results.push(fail([`Scene ${scene.sceneNumber} has no narration.`]));
    if (scene.visualDescription.trim() === "")
      results.push(
        fail([`Scene ${scene.sceneNumber} has no visual description.`]),
      );
    const words = scene.narrationText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (words > 180)
      results.push(
        warn([
          `Scene ${scene.sceneNumber} narrates ${words} words on one image; consider splitting it.`,
        ]),
      );
  }
  if (results.length === 0)
    return pass(
      [`${input.scenes.length} scenes, each with narration and a visual.`],
      100,
    );
  return combineGateResults(results);
}
