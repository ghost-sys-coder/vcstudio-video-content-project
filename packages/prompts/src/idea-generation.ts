export const IDEA_GENERATION_PROMPT_VERSION = "idea-generation-v1";

const IDEA_PLATFORMS = ["youtube", "tiktok", "facebook", "instagram"] as const;
export type IdeaGenerationPlatform = (typeof IDEA_PLATFORMS)[number];

export type IdeaGenerationPromptInput = {
  /** Free-text niche or field the ideas should sit in. */
  niche: string;
  /** How many distinct idea cards to produce. */
  count: number;
  /** When set, every idea targets this platform; otherwise the model picks the best fit per idea. */
  platform: IdeaGenerationPlatform | null;
  /** Optional tone/style steer (e.g. "dry and witty", "warm and encouraging"). */
  tonePreference: string | null;
  language: string;
};

const platformLabels: Record<IdeaGenerationPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram Reels",
};

function platformDirective(platform: IdeaGenerationPlatform | null): string {
  if (platform)
    return `Every idea must target ${platformLabels[platform]}. Set primaryPlatform to "${platform}" for all of them and size targetDurationSeconds to what performs on that platform.`;
  return 'For each idea, choose the single best-fit platform and set primaryPlatform to one of: "youtube", "tiktok", "facebook", "instagram". Size targetDurationSeconds to that platform (short-form vertical 15-90s; longer educational YouTube up to a few minutes).';
}

/**
 * Deterministic, versioned prompt for the Idea Lab. Produces pre-project briefs
 * for a niche: each idea carries exactly the fields a project brief needs plus a
 * short rationale and hook type. Encodes proven, high-retention formats — it must
 * never claim an idea is guaranteed to go viral or is currently trending.
 */
export function renderIdeaGenerationPrompt(
  input: IdeaGenerationPromptInput,
): string {
  const steer = [
    `- Niche / field: ${input.niche}`,
    input.tonePreference
      ? `- Preferred tone / style: ${input.tonePreference}`
      : null,
    `- Output language: ${input.language}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `You are a seasoned content strategist for short-form and educational video. You help a creator find strong, specific video ideas in a niche and shape each one into a production brief.

Produce ${input.count} genuinely distinct video ideas for this niche.

Brief:
${steer}

${platformDirective(input.platform)}

For each idea, return these fields:
- topic: the specific video idea in one clear sentence. Concrete and narrow beats broad. This becomes the project topic.
- targetAudience: who this is for, specifically (their situation or skill level), not "everyone".
- tone: the delivery style that best serves this idea and audience.
- targetDurationSeconds: a realistic runtime for the platform and format, as an integer number of seconds.
- primaryPlatform: the distribution platform, chosen as instructed above.
- hookAngle: the opening angle that earns the first few seconds — the specific promise, tension, or question that stops the scroll.
- rationale: one short sentence on why this format tends to hold attention for this audience.
- hookType: the primary hook pattern in 1-3 words (e.g. "curiosity-gap", "common-mistake", "numbered-list", "myth-bust", "quick-win", "story-tease").

Rules:
- Make the ideas meaningfully different from one another in angle and format, not variations of one topic.
- Favor educational value and a clear viewer payoff; ideas should be genuinely useful, not empty engagement bait.
- Be honest: these are proven, high-engagement formats worth testing and A/B comparing. Do NOT claim any idea is guaranteed to go viral, and do NOT describe anything as "currently trending" — you cannot verify live trends.
- Do not invent statistics or present unverified claims as fact.
- Write every field in ${input.language}.`;
}
