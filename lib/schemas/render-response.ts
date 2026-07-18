import { z } from "zod";
import type { RenderWorkspaceResponse } from "@/lib/render/render-view";

const renderStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);

const renderExportSchema = z.object({
  id: z.string(),
  status: renderStatusSchema,
  preset: z.string(),
  aspectRatio: aspectRatioSchema,
  width: z.number(),
  height: z.number(),
  framesPerSecond: z.number(),
  includeCaptions: z.boolean(),
  includeWatermark: z.boolean(),
  sceneCount: z.number(),
  captionCount: z.number(),
  durationMilliseconds: z.number(),
  totalFrames: z.number(),
  progressPercent: z.number(),
  estimatedCostCents: z.number(),
  actualCostCents: z.number().nullable(),
  sizeBytes: z.number().nullable(),
  hasAsset: z.boolean(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

const timelineSummarySchema = z.object({
  status: z.enum(["ready", "invalid"]),
  width: z.number(),
  height: z.number(),
  framesPerSecond: z.number(),
  sceneCount: z.number(),
  captionCount: z.number(),
  totalDurationMilliseconds: z.number(),
  totalFrames: z.number(),
  errorCount: z.number(),
  warningCount: z.number(),
  issues: z.array(
    z.object({
      sceneNumber: z.number().nullable(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
    }),
  ),
});

const presetSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  aspectRatio: aspectRatioSchema,
  width: z.number(),
  height: z.number(),
  isProjectDefault: z.boolean(),
  disabled: z.boolean(),
});

const workspaceViewSchema = z.object({
  timeline: timelineSummarySchema,
  presets: z.array(presetSchema),
  configuration: z.object({
    enabled: z.boolean(),
    maxRenderDurationSeconds: z.number(),
    estimatedCostCents: z.number(),
    withinDurationLimit: z.boolean(),
    watermarkAvailable: z.boolean(),
  }),
  exports: z.array(renderExportSchema),
  activeRender: renderExportSchema.nullable(),
  availableBudgetCents: z.number(),
});

export const renderWorkspaceResponseSchema: z.ZodType<RenderWorkspaceResponse> =
  z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: workspaceViewSchema }),
    z.object({ success: z.literal(false), error: z.string() }),
  ]);
