import type { ScriptGenerationPlatform } from "./script-generation";

export const TITLE_GENERATION_PROMPT_VERSION = "publishing-metadata-v2";

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
  titleGuidance: string;
  titleLength: string;
  hookTypes: string;
  descriptionGuidance: string;
  tagGuidance: string;
};

const platformProfiles: Record<ScriptGenerationPlatform, PlatformProfile> = {
  youtube: {
    label: "YouTube",
    titleGuidance:
      "Front-load the most compelling words. Favor a clear curiosity gap, a concrete number, a bold-but-defensible claim, or a bracketed qualifier. Avoid clickbait the video cannot deliver on.",
    titleLength:
      "Keep each title roughly 40-70 characters so it is not truncated in search and suggested feeds.",
    hookTypes:
      "curiosity-gap, number/list, how-to, bold-claim, question, contrast",
    descriptionGuidance:
      "Write a useful 2-4 paragraph YouTube description. Put the primary topic and viewer payoff naturally in the first 150 characters, summarize what the video covers, and end with one relevant call to action. Do not add chapters, links, or claims absent from the source material.",
    tagGuidance:
      "Return 3-8 focused YouTube tags. Use the primary topic, close variants, and a likely misspelling only when genuinely useful; YouTube treats titles, thumbnails, and descriptions as more important than tags. Do not include # symbols.",
  },
  tiktok: {
    label: "TikTok",
    titleGuidance:
      "The first 2-3 words must stop the scroll. Use punchy, spoken, lowercase-friendly phrasing, one idea, and a clear implied payoff.",
    titleLength:
      "Keep each title short and punchy, ideally under 50 characters.",
    hookTypes: "scroll-stopper, secret/reveal, relatable, challenge, question",
    descriptionGuidance:
      "Write a concise TikTok caption with a strong first line, conversational payoff, and one light call to action. It must be useful copy the creator can paste after inbox delivery.",
    tagGuidance:
      "Return 3-6 highly relevant TikTok hashtags without # symbols. Prefer topical and niche tags over generic reach-bait such as fyp or viral.",
  },
  facebook: {
    label: "Facebook",
    titleGuidance:
      "Lead with emotion and clear stakes for a sound-off, caption-reading audience. Favor relatable and shareable language over cleverness.",
    titleLength:
      "Keep each title concise and skimmable, around 40-65 characters.",
    hookTypes: "emotional, relatable, stakes, question, story-tease",
    descriptionGuidance:
      "Write a Facebook video description in 1-3 short paragraphs. Lead with an emotional or practical hook, explain the viewer benefit, and finish with a genuine conversation prompt or sharing call to action.",
    tagGuidance:
      "Return 3-6 specific topic labels without # symbols. Avoid generic engagement bait.",
  },
  instagram: {
    label: "Instagram Reels",
    titleGuidance:
      "Use energetic, trend-aware, visually evocative phrasing with a crisp payoff. Prefer natural hooks over a hard sell.",
    titleLength:
      "Keep each title tight and energetic, around 30-60 characters.",
    hookTypes: "aspirational, relatable, trend, reveal, question",
    descriptionGuidance:
      "Write an Instagram Reel caption with a hook in the first line, short readable paragraphs, a clear payoff, and one natural call to action. Do not put hashtags in the description because they are returned separately.",
    tagGuidance:
      "Return 3-8 relevant Instagram hashtags without # symbols, balancing broad topic, niche, and audience-intent terms. Do not use generic spam tags.",
  },
};

function scriptContextBlock(script: string | null): string {
  const trimmed = script?.trim() ?? "";
  if (trimmed === "")
    return "No finished script is available yet. Work from the brief above.";
  const excerpt =
    trimmed.length > 2400 ? `${trimmed.slice(0, 2400)}…` : trimmed;
  return `Approved script (use it to keep all metadata accurate to the actual content):\n"""\n${excerpt}\n"""`;
}

/** Deterministic, versioned prompt for complete per-platform metadata. */
export function renderTitleGenerationPrompt(
  input: TitleGenerationPromptInput,
): string {
  const profile = platformProfiles[input.platform];
  const brief = [
    `- Topic: ${input.topic || "(not specified - infer a strong, specific angle from the script)"}`,
    input.targetAudience ? `- Target audience: ${input.targetAudience}` : null,
    input.tone ? `- Tone / style: ${input.tone}` : null,
    input.hookAngle ? `- Preferred hook angle: ${input.hookAngle}` : null,
    `- Language: ${input.language}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `You are an expert ${profile.label} publishing strategist who writes metadata that earns honest attention and accurately represents the video.

Write ${input.optionCount} distinct ${profile.label} title options plus one publication-ready description/caption and one set of discovery tags for this video.

Brief:
${brief}

${scriptContextBlock(input.script)}

${profile.label} title guidance:
${profile.titleGuidance}
${profile.titleLength}

For each title, return:
- text: the title itself, written in ${input.language}.
- rationale: one short sentence explaining why it fits the audience and platform.
- hookType: the primary hook used, chosen from: ${profile.hookTypes}.

Description/caption guidance:
${profile.descriptionGuidance}

Tag guidance:
${profile.tagGuidance}

Also return:
- description: the final publication-ready description or caption, written in ${input.language}.
- tags: a deduplicated array of relevant tags without # symbols.

Rules:
- Make title options genuinely different by varying hook type and angle.
- All metadata must be accurate to the source. Do not promise a payoff the video lacks.
- Do not put emojis, hashtags, surrounding quotes, or ALL CAPS words in titles.
- Keep keywords natural. Never keyword-stuff or use irrelevant trend tags.
- Do not invent statistics or claims presented as verified.`;
}
