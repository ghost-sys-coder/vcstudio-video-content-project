import { z } from "zod";
import { sceneImageQualitySchema } from "@/lib/schemas/scene-image";

/**
 * What a production run is allowed to decide on its own.
 *
 * `auto` means the run accepts a stage's output when the stage gate passes,
 * without a person looking at it. `hold` means the run stops at that stage and
 * waits for a person, even when the gate passes. The release stage is always a
 * hold in this version: assembling the title, description and thumbnail is
 * automated, but nothing is confirmed or scheduled without a creator.
 *
 * The policy is frozen onto the run when it starts, so changing the defaults
 * later cannot change what an in-flight run is permitted to do.
 */
export const PRODUCTION_RUN_POLICY_VERSION = 1;

export const stageApprovalModeSchema = z.enum(["auto", "hold"]);
export type StageApprovalMode = z.infer<typeof stageApprovalModeSchema>;

export const AUTOMATED_PRODUCTION_STAGES = [
  "script",
  "scenes",
  "images",
  "audio",
  "render",
] as const;
export type AutomatedProductionStage =
  (typeof AUTOMATED_PRODUCTION_STAGES)[number];

/** Bounds that keep one run from spending without limit. */
export const PRODUCTION_RUN_MAX_COST_CEILING_CENTS = 10_000;
export const PRODUCTION_RUN_MAX_STAGE_ATTEMPTS = 2;

export const productionRunPolicySchema = z.object({
  version: z.literal(PRODUCTION_RUN_POLICY_VERSION),
  stages: z.object({
    script: stageApprovalModeSchema,
    scenes: stageApprovalModeSchema,
    images: stageApprovalModeSchema,
    audio: stageApprovalModeSchema,
    render: stageApprovalModeSchema,
  }),
  /** The quality every scene image in this run is generated at. */
  imageQuality: sceneImageQualitySchema,
  /** The voice preset narration uses; null means the workspace default. */
  voicePresetId: z.uuid().nullable(),
  /**
   * The most this run may commit across all of its stages, in cents. Checked
   * before every billable step against the estimates the run has already
   * caused, and never above the project's own budget.
   */
  maximumCostCents: z
    .number()
    .int()
    .min(0)
    .max(PRODUCTION_RUN_MAX_COST_CEILING_CENTS),
  /**
   * How many times a failed stage may be started again before the run holds.
   * One retry is the default; unlimited retries of a paid step are forbidden.
   */
  maximumStageAttempts: z
    .number()
    .int()
    .min(1)
    .max(PRODUCTION_RUN_MAX_STAGE_ATTEMPTS),
});

export type ProductionRunPolicy = z.infer<typeof productionRunPolicySchema>;

export function defaultProductionRunPolicy(input: {
  maximumCostCents: number;
}): ProductionRunPolicy {
  return {
    version: PRODUCTION_RUN_POLICY_VERSION,
    stages: {
      script: "auto",
      scenes: "auto",
      images: "auto",
      audio: "auto",
      render: "auto",
    },
    imageQuality: "medium",
    voicePresetId: null,
    maximumCostCents: Math.max(
      0,
      Math.min(PRODUCTION_RUN_MAX_COST_CEILING_CENTS, input.maximumCostCents),
    ),
    maximumStageAttempts: 2,
  };
}

/** Reads a stored policy, refusing anything that is not exactly the frozen shape. */
export function parseProductionRunPolicy(value: unknown): ProductionRunPolicy {
  return productionRunPolicySchema.parse(value);
}
