export type SuggestedNiche = {
  niche: string;
  /** Tone/style that tends to perform best for this niche; prefills the tone field. */
  tone: string;
};

/**
 * A curated sample of proven, high-retention niches that suit this tool's
 * educational short-form focus, each paired with a tone/style that tends to work
 * well for it. Selecting one prefills both the niche and tone fields — both stay
 * free text, so a typed value always takes precedence over a suggestion.
 */
export const SUGGESTED_NICHES: readonly SuggestedNiche[] = [
  {
    niche: "Personal finance & money habits",
    tone: "Clear, encouraging, no jargon",
  },
  {
    niche: "Productivity & time management",
    tone: "Practical, upbeat, actionable",
  },
  {
    niche: "Study tips & effective learning",
    tone: "Friendly, motivating, straightforward",
  },
  {
    niche: "Psychology & self-improvement",
    tone: "Warm, reflective, insightful",
  },
  {
    niche: "Health & fitness basics",
    tone: "Energetic, supportive, myth-busting",
  },
  {
    niche: "Science explained simply",
    tone: "Curious, playful, wonder-driven",
  },
  {
    niche: "History in short stories",
    tone: "Vivid, dramatic, storytelling",
  },
  {
    niche: "Tech & AI explainers",
    tone: "Plain-spoken, confident, hype-free",
  },
  {
    niche: "Career & job skills",
    tone: "Direct, professional, empowering",
  },
  {
    niche: "Coding for beginners",
    tone: "Patient, encouraging, step-by-step",
  },
  {
    niche: "Motivation & mindset",
    tone: "Bold, punchy, inspiring",
  },
  {
    niche: "Business & side hustles",
    tone: "Sharp, pragmatic, results-focused",
  },
] as const;
