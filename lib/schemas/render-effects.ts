import { z } from "zod";

export const levelMeterPositionSchema = z.enum([
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
  "topLeft",
  "topCenter",
  "topRight",
]);

export type LevelMeterPosition = z.infer<typeof levelMeterPositionSchema>;

/**
 * The presentation effects form, submitted whole.
 *
 * `expectedRevision` is the optimistic lock: empty creates the row, a number
 * must match the row being replaced. It is empty exactly once per project,
 * which is why it is a union rather than a required number.
 */
export const saveRenderEffectsSchema = z.object({
  projectId: z.uuid(),
  backgroundMediaAssetId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => (value ? value : null)),
  backgroundVolumePercent: z.coerce.number().int().min(0).max(100),
  backgroundLoop: z.coerce.boolean(),
  levelMeterEnabled: z.coerce.boolean(),
  levelMeterPosition: levelMeterPositionSchema,
  expectedRevision: z
    .union([z.coerce.number().int().positive(), z.literal("")])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
});

export function readRenderEffectsForm(formData: FormData) {
  return {
    projectId: formData.get("projectId"),
    backgroundMediaAssetId: formData.get("backgroundMediaAssetId") ?? "",
    backgroundVolumePercent: formData.get("backgroundVolumePercent"),
    // An unchecked checkbox submits nothing at all, so absence is false.
    backgroundLoop: formData.get("backgroundLoop") === "on",
    levelMeterEnabled: formData.get("levelMeterEnabled") === "on",
    levelMeterPosition: formData.get("levelMeterPosition"),
    expectedRevision: formData.get("expectedRevision") ?? "",
  };
}
