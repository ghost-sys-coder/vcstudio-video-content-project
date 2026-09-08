/**
 * Bumped to v2 when script-to-scene fidelity validation landed: the coverage
 * contract below is now enforced after generation, so the instruction and the
 * check have to describe the same rule. Existing runs keep their stored
 * `finalPrompt` and remain reproducible; only new runs use v2, and the version
 * participates in the idempotency key so a v1 run is never confused with a v2
 * one.
 */
export const SCENE_ANALYSIS_PROMPT_VERSION = "scene-analysis-v2";

const COVERAGE_CONTRACT = `Narration fidelity (enforced automatically after you answer):
- Copy narration from the script character for character. Do not reword, summarise, expand, translate, or correct it.
- Do not change punctuation, quotation marks, dashes, capitalisation, or numbers.
- Concatenating every scene's narrationText in order must reproduce the entire approved script exactly once, with nothing added, dropped, duplicated, or reordered.
- Split only at boundaries that fall between characters of the script; every character of the script must land in exactly one scene.
- Do not write commentary, titles, or transitions into narrationText.`;

export function renderSceneAnalysisPrompt(input: {
  script: string;
  maximumScenes: number;
  aspectRatio: string;
  language: string;
}): string {
  return `You are a senior storyboard artist planning narration-led video scenes.

Convert the approved narration script into an ordered set of no more than ${input.maximumScenes} production-ready scenes.
The project aspect ratio is ${input.aspectRatio} and language is ${input.language}.

${COVERAGE_CONTRACT}

Requirements:
- Make visual, location, action, camera, emotional, character, prop, and continuity fields concrete and useful for later image generation.
- Use milliseconds for estimated duration. Prefer natural narration pacing.
- Use empty arrays when no characters or props appear and an empty string when no continuity note is needed.
- Do not add claims or story events absent from the script.

Approved script:
<script>
${input.script}
</script>`;
}

/**
 * Second and final attempt after a scene plan fails coverage validation. The
 * discrepancy is quoted back because a bare "try again" reproduces the same
 * error; naming the offending scene and offset is what makes one bounded retry
 * worth its cost.
 */
export function renderSceneAnalysisRepairPrompt(input: {
  script: string;
  maximumScenes: number;
  aspectRatio: string;
  language: string;
  discrepancy: string;
}): string {
  return `You are a senior storyboard artist correcting a rejected scene plan.

Your previous scene plan for this script was rejected because its narration did not reproduce the approved script exactly once and in order.

Rejection reason:
<rejection>
${input.discrepancy}
</rejection>

Produce a corrected plan of no more than ${input.maximumScenes} scenes.
The project aspect ratio is ${input.aspectRatio} and language is ${input.language}.

${COVERAGE_CONTRACT}

Other requirements:
- Keep visual, location, action, camera, emotional, character, prop, and continuity fields concrete and useful for later image generation.
- Use milliseconds for estimated duration. Prefer natural narration pacing.
- Use empty arrays when no characters or props appear and an empty string when no continuity note is needed.
- Do not add claims or story events absent from the script.

Approved script:
<script>
${input.script}
</script>`;
}
