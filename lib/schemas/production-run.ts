import { z } from "zod";
import {
  PRODUCTION_RUN_MAX_COST_CEILING_CENTS,
  PRODUCTION_RUN_MAX_STAGE_ATTEMPTS,
  stageApprovalModeSchema,
} from "@/lib/production-runs/production-run-policy";
import { sceneImageQualitySchema } from "@/lib/schemas/scene-image";

/**
 * What a browser may say when starting a run.
 *
 * The form submits each stage's mode by name, a cost ceiling in whole dollars
 * (which people reason in) and the image quality. The policy's version and
 * attempt bound are set on the server, never taken from the form.
 */
export const startProductionRunSchema = z.object({
  projectId: z.uuid(),
  scriptMode: stageApprovalModeSchema,
  scenesMode: stageApprovalModeSchema,
  imagesMode: stageApprovalModeSchema,
  audioMode: stageApprovalModeSchema,
  renderMode: stageApprovalModeSchema,
  imageQuality: sceneImageQualitySchema,
  voicePresetId: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.union([z.literal(""), z.uuid()]))
    .transform((value) => (value === "" ? null : value)),
  maximumCostDollars: z.coerce
    .number()
    .min(0)
    .max(PRODUCTION_RUN_MAX_COST_CEILING_CENTS / 100),
  retryFailedStages: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) =>
      value === "true" ? PRODUCTION_RUN_MAX_STAGE_ATTEMPTS : 1,
    ),
});

export type StartProductionRunInput = z.infer<typeof startProductionRunSchema>;

export const productionRunMutationSchema = z.object({
  projectId: z.uuid(),
  runId: z.uuid(),
});
