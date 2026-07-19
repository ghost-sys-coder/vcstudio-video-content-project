export const SCRIPT_GENERATION_PROMPT_VERSION = "script-generation-v1";

export type ScriptGenerationPlatform =
  "youtube" | "tiktok" | "facebook" | "instagram";

export type ScriptGenerationPromptInput = {
  topic: string;
  targetAudience: string;
  tone: string;
  targetDurationSeconds: number | null;
  primaryPlatform: ScriptGenerationPlatform;
  hookAngle: string;
  language: string;
};

const platformGuidance: Record<ScriptGenerationPlatform, string> = {
  youtube:
    "YouTube: earn the click in the first 5–10 seconds, then keep re-hooking; conversational but information-dense; natural spots for retention resets.",
  tiktok:
    "TikTok: hook in the first 1–2 seconds, fast pacing, punchy sentences, one clear idea, strong loop-back ending.",
  facebook:
    "Facebook: relatable, emotional, clear stakes; assume sound-off viewers may read captions, so make the opening line land on its own.",
  instagram:
    "Instagram Reels: visually-driven, tight and energetic, trend-aware phrasing, a crisp payoff.",
};

function targetLengthLine(targetDurationSeconds: number | null): string {
  if (!targetDurationSeconds || targetDurationSeconds <= 0)
    return "Aim for a tight, well-paced script with no filler.";
  const words = Math.round((targetDurationSeconds * 2.5) / 10) * 10;
  return `Target about ${targetDurationSeconds} seconds of narration (~${words} words at a natural speaking pace). Do not pad to hit the length.`;
}

/**
 * Deterministic prompt that turns a content brief into a narration-ready script.
 * Encodes proven hook-first, retention-oriented structure and platform pacing —
 * these are best-practice heuristics, not a guarantee of performance.
 */
export function renderScriptGenerationPrompt(
  input: ScriptGenerationPromptInput,
): string {
  const brief = [
    `- Topic: ${input.topic || "(not specified — infer a strong, specific angle)"}`,
    input.targetAudience ? `- Target audience: ${input.targetAudience}` : null,
    input.tone ? `- Tone / style: ${input.tone}` : null,
    input.hookAngle ? `- Preferred hook angle: ${input.hookAngle}` : null,
    `- Language: ${input.language}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `You are an expert video scriptwriter who writes high-retention narration.

Write a complete, ready-to-narrate script for the following brief.

Brief:
${brief}

Platform:
${platformGuidance[input.primaryPlatform]}

Length:
${targetLengthLine(input.targetDurationSeconds)}

Proven structure to follow (adapt, do not label the sections in the output):
- Hook: open with a curiosity gap, bold claim, surprising fact, or a stakes-raising question.
- Setup: quickly frame why it matters to this audience.
- Value: deliver the core content in a clear, logically ordered progression; keep re-engaging attention.
- Payoff + CTA: land the promise from the hook and end with a natural call to action.

Output requirements:
- Return NARRATION ONLY — the exact words to be spoken. No scene directions, camera notes, headings, speaker labels, timestamps, emojis, or markdown.
- Write in ${input.language}.
- Keep sentences speakable and natural for a voiceover.
- Also return one strong suggested title for this video.
- Do not invent statistics or facts presented as verified; keep claims defensible.`;
}
