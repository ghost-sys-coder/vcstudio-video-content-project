import type { ScriptGenerationPlatform } from "./script-generation";

export const TITLE_GENERATION_PROMPT_VERSION = "title-generation-v1";

export type TitleGenerationPromptInput = {
  platform: ScriptGenerationPlatform;
  topic: string;
  targetAudience: string;
  tone: string;
  hookAngle: string;
  /** Approved narration script, when one exists, used as grounding context. */
  script: string | null;
  language: string;
  optionCount: number;
};

type PlatformProfile = {
  label: string;
  guidance: string;
  lengthLine: string;
  hookTypes: string;
};

/**
 * Per-platform title heuristics. These encode proven curiosity-gap / number /
 * emotional patterns that tend to lift click-through — best practices worth
 * A/B testing, not a guarantee of performance.
 */
const platformProfiles: Record<ScriptGenerationPlatform, PlatformProfile> = {
  youtube: {
    label: "YouTube",
    guidance:
      "Front-load the most compelling words. Favor a clear curiosity gap, a concrete number, a bold-but-defensible claim, or a bracketed qualifier. Avoid clickbait that the video cannot deliver on.",
    lengthLine:
      "Keep each title roughly 40–70 characters so it is not truncated in search and suggested feeds.",
    hookTypes:
      "curiosity-gap, number/list, how-to, bold-claim, question, contrast",
  },
  tiktok: {
    label: "TikTok",
    guidance:
      "The first 2–3 words must stop the scroll. Punchy, spoken, lowercase-friendly phrasing. One idea only. Imply a payoff the viewer has to watch for.",
    lengthLine:
      "Keep each title short and punchy — ideally under 50 characters.",
    hookTypes: "scroll-stopper, secret/reveal, relatable, challenge, question",
  },
  facebook: {
    label: "Facebook",
    guidance:
      "Lead with emotion and clear stakes so it lands for a sound-off, caption-reading audience. Relatable and shareable over clever.",
    lengthLine:
      "Keep each title concise and skimmable — around 40–65 characters.",
    hookTypes: "emotional, relatable, stakes, question, story-tease",
  },
  instagram: {
    label: "Instagram Reels",
    guidance:
      "Energetic, trend-aware, visually evocative phrasing with a crisp payoff. Light, natural use of hooks over hard-sell.",
    lengthLine:
      "Keep each title tight and energetic — around 30–60 characters.",
    hookTypes: "aspirational, relatable, trend, reveal, question",
  },
};

function scriptContextBlock(script: string | null): string {
  const trimmed = script?.trim() ?? "";
  if (trimmed === "")
    return "No finished script is available yet. Work from the brief above.";
  // Bound the grounding context so a long script cannot dominate the prompt or
  // inflate token cost; the opening carries the hook that titles should match.
  const excerpt =
    trimmed.length > 2400 ? `${trimmed.slice(0, 2400)}…` : trimmed;
  return `Approved script (use it to keep titles accurate to the actual content):\n"""\n${excerpt}\n"""`;
}

/**
 * Deterministic prompt that turns a brief (and optional approved script) into a
 * set of platform-tuned title options, each with a short rationale and a hook
 * type. Encodes proven engagement heuristics — not a guarantee of virality.
 */
export function renderTitleGenerationPrompt(
  input: TitleGenerationPromptInput,
): string {
  const profile = platformProfiles[input.platform];
  const brief = [
    `- Topic: ${input.topic || "(not specified — infer a strong, specific angle from the script)"}`,
    input.targetAudience ? `- Target audience: ${input.targetAudience}` : null,
    input.tone ? `- Tone / style: ${input.tone}` : null,
    input.hookAngle ? `- Preferred hook angle: ${input.hookAngle}` : null,
    `- Language: ${input.language}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `You are an expert ${profile.label} title strategist who writes titles that earn honest clicks.

Write ${input.optionCount} distinct ${profile.label} title options for this video.

Brief:
${brief}

${scriptContextBlock(input.script)}

${profile.label} title guidance:
${profile.guidance}
${profile.lengthLine}

For each title, return:
- text: the title itself, written in ${input.language}.
- rationale: one short sentence on why this title should perform well.
- hookType: the primary hook used, chosen from: ${profile.hookTypes}.

Rules:
- Make the options genuinely different from one another (vary the hook type and angle).
- Titles must be accurate to the content — no bait the video cannot pay off.
- No emojis, hashtags, surrounding quotes, or ALL CAPS words.
- Do not invent statistics or claims presented as verified.`;
}
