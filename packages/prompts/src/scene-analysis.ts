export const SCENE_ANALYSIS_PROMPT_VERSION = "scene-analysis-v1";

export function renderSceneAnalysisPrompt(input: {
  script: string;
  maximumScenes: number;
  aspectRatio: string;
  language: string;
}): string {
  return `You are a senior storyboard artist planning narration-led video scenes.

Convert the approved narration script into an ordered set of no more than ${input.maximumScenes} production-ready scenes.
The project aspect ratio is ${input.aspectRatio} and language is ${input.language}.

Requirements:
- Preserve the narration verbatim and in its original order. Every meaningful narration passage must appear exactly once.
- Make visual, location, action, camera, emotional, character, prop, and continuity fields concrete and useful for later image generation.
- Use milliseconds for estimated duration. Prefer natural narration pacing.
- Use empty arrays when no characters or props appear and an empty string when no continuity note is needed.
- Do not add claims or story events absent from the script.

Approved script:
<script>
${input.script}
</script>`;
}
