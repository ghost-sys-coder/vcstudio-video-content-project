import type { ShortClipDefinition } from "@/lib/shorts/short-timeline";
import { createProductionBaselineFixture } from "@/lib/test-utils/version-two-production-fixture";

/** Test-only editorial intent. It does not extend the production render contract. */
export const MONEY_MADE_CLEAR_PROFILE = {
  name: "Money Made Clear",
  audience: { minimumAge: 20, maximumAge: 45, markets: ["US", "UK"] },
  topics: [
    "personal finance",
    "money management",
    "investing fundamentals",
    "banking",
    "economics",
    "debt",
    "credit",
    "wealth building",
  ],
  tone: "Practical financial education without hype or get-rich-quick claims",
  longForm: {
    minimumSeconds: 480,
    maximumSeconds: 720,
    minimumScenes: 20,
    maximumScenes: 40,
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
  },
  cadence: { longVideosPerWeek: 1, minimumClips: 3, maximumClips: 5 },
  clipTargets: ["youtube", "tiktok", "instagram", "facebook"],
  narration: "voiceover",
  visualStyle: "faceless",
  coreAnimatedCharacters: false,
  captions: "optional or burned-in",
  audio: { lowVolumeMusicBed: true, selectiveSoundEffects: true },
} as const;

type VisualRequirement =
  | "video"
  | "still"
  | "motionGraphic"
  | "animatedText"
  | "chart"
  | "table"
  | "screenExample";

const sections: Array<{
  stage: string;
  scenes: number;
  narration: string;
  visual: VisualRequirement;
}> = [
  {
    stage: "hook",
    scenes: 2,
    narration:
      "Where did the money go? This fictional monthly budget will make every part of the example visible, one step at a time.",
    visual: "animatedText",
  },
  {
    stage: "context",
    scenes: 4,
    narration:
      "The amounts in this demonstration are invented for arithmetic testing. They are not typical household spending, recommended allocations, or a forecast.",
    visual: "video",
  },
  {
    stage: "explanation",
    scenes: 10,
    narration:
      "Keep income, spending, and the remaining amount in separate categories. This example uses neutral units so it does not silently mix dollars and pounds.",
    visual: "motionGraphic",
  },
  {
    stage: "workedExample",
    scenes: 10,
    narration:
      "In this fictional example, 3000 units come in. Subtract 1800 units for one category and 600 for another; the remaining amount is 600 units.",
    visual: "screenExample",
  },
  {
    stage: "supportingVisuals",
    scenes: 8,
    narration:
      "The table and chart must show the same illustrative amounts. Their labels should distinguish money already spent from the amount remaining in this example.",
    visual: "chart",
  },
  {
    stage: "keyTakeaway",
    scenes: 3,
    narration:
      "The takeaway is the arithmetic of this example, not a universal spending rule. Keep each assumption visible when comparing different scenarios.",
    visual: "table",
  },
  {
    stage: "conclusion",
    scenes: 3,
    narration:
      "Review the example and its assumptions before using the format for another explanation. Money Made Clear aims to explain financial ideas without promising an outcome.",
    visual: "still",
  },
];

export function createMoneyMadeClearFixture() {
  const scenePlan = sections.flatMap((section) =>
    Array.from({ length: section.scenes }, () => ({
      stage: section.stage,
      narrationText: section.narration,
      visualRequirement: section.visual,
    })),
  );
  const base = createProductionBaselineFixture({
    sceneDurationMilliseconds: 15_000,
    sceneCopy: (sceneNumber) => {
      const entry = scenePlan[sceneNumber - 1];
      if (!entry)
        throw new Error("Missing Money Made Clear scene specification.");
      return {
        narrationText: entry.narrationText,
        visualDescription: `Money Made Clear ${entry.stage}: ${entry.visualRequirement} for a clearly labeled fictional budget example. No identifiable person or animated character.`,
      };
    },
  });
  // Four standalone editorial candidates, not four different crops of one clip.
  // Their media remain still proxies until V2-13 implements the required tracks.
  const shortCandidates = [
    { name: "Read the categories", startIndex: 6 },
    { name: "Walk through the numbers", startIndex: 16 },
    { name: "Read the chart", startIndex: 26 },
    { name: "Understand the takeaway", startIndex: 34 },
  ].map((candidate, candidateIndex) => ({
    name: candidate.name,
    targets: MONEY_MADE_CLEAR_PROFILE.clipTargets,
    clips: base.timeline.scenes
      .slice(candidate.startIndex, candidate.startIndex + 3)
      .map((scene, index): ShortClipDefinition => ({
        id: `00000008-0000-4000-8000-${String(candidateIndex * 3 + index + 1).padStart(12, "0")}`,
        sourceSceneId: scene.sceneId,
        sourceSceneVersionId: scene.sceneVersionId,
        position: index + 1,
        sourceStartMilliseconds: scene.startMilliseconds,
        sourceEndMilliseconds: scene.endMilliseconds,
        transition: "cut",
      })),
  }));
  return {
    ...base,
    fixtureVersion: "money-made-clear-v1",
    profile: MONEY_MADE_CLEAR_PROFILE,
    scenePlan,
    shortCandidates,
    illustrativeBudget: {
      unit: "neutral illustrative units",
      income: 3000,
      essentialSpending: 1800,
      flexibleSpending: 600,
      remaining: 600,
      source: "synthetic arithmetic fixture; not observed financial data",
    },
    // The required visual/audio types above describe the target, not shipped features.
    executionMode:
      "synthetic still-image proxy; no live media or generation" as const,
  };
}
