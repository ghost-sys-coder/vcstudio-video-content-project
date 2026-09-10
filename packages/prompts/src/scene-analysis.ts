/**
 * Bumped to v3 when creator-authored scene structure landed. A script written
 * outside this tool usually already states its own segments, so the model is
 * now told to honour that segmentation instead of inventing a second one.
 *
 * v2 introduced the coverage contract below, which is enforced after
 * generation, so the instruction and the check have to describe the same rule.
 * Existing runs keep their stored `finalPrompt` and remain reproducible; only
 * new runs use v3, and the version participates in the idempotency key so runs
 * from different template versions are never confused with one another.
 */
export const SCENE_ANALYSIS_PROMPT_VERSION = "scene-analysis-v3";

/**
 * One segment the creator wrote themselves, with the production direction they
 * attached to it. `narration` is the spoken text only: markers such as
 * [VISUAL] or [TEXT OVERLAY] have already been separated out, so the model
 * never sees them as words to reproduce.
 */
export interface SceneAnalysisSegmentHint {
  number: number;
  title: string;
  /** The creator's own timing, e.g. "0:00 - 1:15", when they gave one. */
  timecodeLabel: string | null;
  narration: string;
  /** The creator's visual, on-screen-text and audio direction, if any. */
  direction: string;
}

/**
 * Renders the creator's own segmentation as instructions.
 *
 * The whole point is that these boundaries are not a suggestion the model may
 * improve on. The creator already decided where the scenes are, so re-deriving
 * them would discard a decision that was already made and risk narration
 * drifting from the document it came from.
 */
function renderSegmentPlan(segments: SceneAnalysisSegmentHint[]): string {
  const blocks = segments
    .map((segment) => {
      const heading = [
        `Scene ${segment.number}`,
        segment.timecodeLabel ? `(${segment.timecodeLabel})` : null,
        segment.title ? `- ${segment.title}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return [
        heading,
        `Narration (copy exactly, do not split or merge):`,
        segment.narration,
        segment.direction
          ? `Creator's direction (use it to write the visual, location, action and camera fields; never speak it):\n${segment.direction}`
          : `Creator's direction: none given.`,
      ].join("\n");
    })
    .join("\n\n");

  return `The creator already divided this script into ${segments.length} scenes. That segmentation is fixed.
- Produce exactly ${segments.length} scenes, in this order, one per segment below.
- Use each segment's narration verbatim as that scene's narrationText. Do not re-split, merge, reorder or re-balance them.
- The creator's direction describes what is on screen. Turn it into the visual, location, action, camera and continuity fields. Never copy it into narrationText.

Creator's scene plan:
<segments>
${blocks}
</segments>`;
}

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
  /** The creator's own segments, when their script already stated them. */
  segments?: SceneAnalysisSegmentHint[];
}): string {
  const plan =
    input.segments && input.segments.length > 0
      ? `\n${renderSegmentPlan(input.segments)}\n`
      : "";
  const task =
    input.segments && input.segments.length > 0
      ? `Turn the creator's existing scene plan into production-ready scenes.`
      : `Convert the approved narration script into an ordered set of no more than ${input.maximumScenes} production-ready scenes.`;
  return `You are a senior storyboard artist planning narration-led video scenes.

${task}
The project aspect ratio is ${input.aspectRatio} and language is ${input.language}.
${plan}
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
  /** Repeated on the retry, so a correction cannot drop the creator's plan. */
  segments?: SceneAnalysisSegmentHint[];
}): string {
  const plan =
    input.segments && input.segments.length > 0
      ? `\n${renderSegmentPlan(input.segments)}\n`
      : "";
  return `You are a senior storyboard artist correcting a rejected scene plan.

Your previous scene plan for this script was rejected because its narration did not reproduce the approved script exactly once and in order.

Rejection reason:
<rejection>
${input.discrepancy}
</rejection>

Produce a corrected plan of no more than ${input.maximumScenes} scenes.
The project aspect ratio is ${input.aspectRatio} and language is ${input.language}.
${plan}
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
