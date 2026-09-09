import { PRODUCTION_STAGE_LABELS } from "@/lib/production/production-queue-view";
import type { ProductionStage } from "@/lib/production/production-readiness";

/** The order production actually moves in, used to draw progress. */
export const PRODUCTION_STAGE_ORDER: ProductionStage[] = [
  "script",
  "scenes",
  "storyboard",
  "audio",
  "render",
  "release",
];

/** Where each stage's work is done. Release has no tab of its own. */
const STAGE_HREF: Record<ProductionStage, string> = {
  script: "script",
  scenes: "scenes",
  storyboard: "storyboard",
  audio: "audio",
  render: "render",
  release: "publish",
};

export type StageState = "done" | "current" | "upcoming";

export interface StageStep {
  stage: ProductionStage;
  label: string;
  href: string;
  state: StageState;
}

/**
 * Describes progress for the overview.
 *
 * "Done" means the project has moved past that stage on the evidence of real
 * output, not that anyone declared it finished. A stage is never marked done
 * because the creator clicked through it.
 */
export function describeStageProgress(current: ProductionStage): StageStep[] {
  const currentIndex = PRODUCTION_STAGE_ORDER.indexOf(current);
  return PRODUCTION_STAGE_ORDER.map((stage, index) => ({
    stage,
    label: PRODUCTION_STAGE_LABELS[stage],
    href: STAGE_HREF[stage],
    state:
      index < currentIndex
        ? ("done" as const)
        : index === currentIndex
          ? ("current" as const)
          : ("upcoming" as const),
  }));
}

/**
 * Reusable resources a format may call for, surfaced from the overview rather
 * than hidden behind a tab the creator has to know about. These are workspace
 * resources, so they deliberately point outside the project.
 */
export const PRODUCTION_RESOURCES = [
  {
    id: "characters",
    label: "Characters",
    description: "Reusable people and their reference images.",
    href: "/app/characters",
  },
  {
    id: "voices",
    label: "Voices",
    description: "Narration voices, including your enrolled custom voices.",
    href: "/app/settings/workspace",
  },
] as const;
