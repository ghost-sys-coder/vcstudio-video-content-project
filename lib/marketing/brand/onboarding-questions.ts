export const ONBOARDING_QUESTION_VERSION = "brand-onboarding-v1";

export const ONBOARDING_SECTIONS = [
  "identity",
  "audience",
  "offers",
  "voice",
  "proof",
  "constraints",
] as const;

export type OnboardingSection = (typeof ONBOARDING_SECTIONS)[number];

export type OnboardingQuestion = {
  key: string;
  section: OnboardingSection;
  prompt: string;
  helpText: string;
  placeholder: string;
  kind: "text" | "longtext";
  required: boolean;
  maxLength: number;
};

export const ONBOARDING_SECTION_LABELS = {
  identity: "Identity",
  audience: "Audience",
  offers: "What you sell",
  voice: "Voice",
  proof: "Proof",
  constraints: "Constraints",
} as const satisfies Record<OnboardingSection, string>;

export const ONBOARDING_SECTION_BLURBS = {
  identity: "What the business is, in your own words.",
  audience: "Who you are trying to reach, and what they care about.",
  offers: "What you sell and why someone picks you over the alternative.",
  voice: "How you sound — and how you never sound.",
  proof: "Facts the studio is allowed to cite. It will not invent any.",
  constraints: "Anything it must never say. These become hard rules.",
} as const satisfies Record<OnboardingSection, string>;

/**
 * The onboarding interview.
 *
 * Deliberately code rather than rows: the catalogue is a contract the profile
 * synthesis depends on, it needs to be versioned alongside the prompt that
 * consumes it, and it is far easier to test as a frozen array than as seed
 * data. Answers are stored per `key`, so adding a question later cannot
 * invalidate existing answers and removing one does not delete them.
 *
 * The wording avoids marketing jargon on purpose. A business owner describing
 * their own business in plain language produces better grounding than one
 * filling in a form that asks for a "value proposition".
 */
export const ONBOARDING_QUESTIONS = [
  {
    key: "business_name",
    section: "identity",
    prompt: "What is the business called?",
    helpText: "Exactly as you write it publicly, including any capitalisation.",
    placeholder: "VeilCode Studio",
    kind: "text",
    required: true,
    maxLength: 120,
  },
  {
    key: "business_what",
    section: "identity",
    prompt: "What does the business actually do?",
    helpText:
      "Write it the way you would say it to a stranger at a bar, not the way a brochure would.",
    placeholder: "We build AI tools that turn a script into a finished video.",
    kind: "longtext",
    required: true,
    maxLength: 1200,
  },
  {
    key: "business_website",
    section: "identity",
    prompt: "Where can people find you online?",
    helpText: "A website or main profile. Leave blank if there isn't one yet.",
    placeholder: "https://veilcode.studio",
    kind: "text",
    required: false,
    maxLength: 300,
  },
  {
    key: "business_industry",
    section: "identity",
    prompt: "What industry would someone file you under?",
    helpText: "Rough is fine. It steers what the studio researches.",
    placeholder: "Creative software / video production",
    kind: "text",
    required: true,
    maxLength: 160,
  },
  {
    key: "audience_who",
    section: "audience",
    prompt: "Who is your best customer?",
    helpText:
      "Describe one real person if that is easier than describing a segment.",
    placeholder:
      "Solo creators publishing several short videos a week who cannot afford an editor.",
    kind: "longtext",
    required: true,
    maxLength: 1200,
  },
  {
    key: "audience_pain",
    section: "audience",
    prompt: "What problem sends them looking for something like you?",
    helpText: "The frustration in their words, not the feature in yours.",
    placeholder:
      "Editing takes longer than filming, so they post less than they meant to.",
    kind: "longtext",
    required: true,
    maxLength: 1200,
  },
  {
    key: "audience_where",
    section: "audience",
    prompt: "Where are they, geographically?",
    helpText:
      "A country, a city, or 'anywhere'. It affects timing and references.",
    placeholder: "Mostly US and UK, some East Africa",
    kind: "text",
    required: false,
    maxLength: 200,
  },
  {
    key: "offers_what",
    section: "offers",
    prompt: "What do you sell?",
    helpText: "List each product or service on its own line.",
    placeholder: "Studio subscription\nOne-off video production\nBrand kits",
    kind: "longtext",
    required: true,
    maxLength: 1500,
  },
  {
    key: "offers_why_you",
    section: "offers",
    prompt: "Why do people choose you over the alternative?",
    helpText:
      "Including 'we are cheaper' or 'we are the only ones nearby' — honest beats impressive.",
    placeholder:
      "The whole pipeline is one tool, so nothing has to be exported and re-imported.",
    kind: "longtext",
    required: true,
    maxLength: 1200,
  },
  {
    key: "voice_sound",
    section: "voice",
    prompt: "How should the business sound?",
    helpText: "Three or four adjectives, then a sentence explaining them.",
    placeholder:
      "Direct, dry, technical. We explain how something works rather than how it feels.",
    kind: "longtext",
    required: true,
    maxLength: 900,
  },
  {
    key: "voice_never",
    section: "voice",
    prompt: "How should it never sound?",
    helpText:
      "This one does more work than the last. Name the tone you hate seeing.",
    placeholder: "Hype. No 'game-changing', no rocket emojis, no fake urgency.",
    kind: "longtext",
    required: true,
    maxLength: 900,
  },
  {
    key: "proof_facts",
    section: "proof",
    prompt: "What can the studio claim as fact?",
    helpText:
      "Numbers, credentials, named customers. Anything not listed here will not be asserted.",
    placeholder: "Founded 2026. Used on 40+ published videos.",
    kind: "longtext",
    required: false,
    maxLength: 1500,
  },
  {
    key: "constraints_never",
    section: "constraints",
    prompt: "What must it never say?",
    helpText:
      "Words, claims, comparisons, or topics that are off limits. One per line.",
    placeholder: "Never claim a guaranteed result\nNever name a competitor",
    kind: "longtext",
    required: false,
    maxLength: 1500,
  },
  {
    key: "constraints_compliance",
    section: "constraints",
    prompt: "Is there regulated language you have to be careful with?",
    helpText:
      "Medical, financial, legal wording, or anything a regulator cares about. Blank if not.",
    placeholder: "",
    kind: "longtext",
    required: false,
    maxLength: 1500,
  },
] as const satisfies readonly OnboardingQuestion[];

export type OnboardingQuestionKey =
  (typeof ONBOARDING_QUESTIONS)[number]["key"];

export function getOnboardingQuestion(
  key: string,
): OnboardingQuestion | undefined {
  return ONBOARDING_QUESTIONS.find((question) => question.key === key);
}

export function selectQuestionsForSection(
  section: OnboardingSection,
): OnboardingQuestion[] {
  return ONBOARDING_QUESTIONS.filter(
    (question) => question.section === section,
  );
}
