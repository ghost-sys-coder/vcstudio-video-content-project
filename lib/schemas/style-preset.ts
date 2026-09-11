import { z } from "zod";
import { projectAspectRatioSchema } from "@/lib/schemas/project";

/**
 * Prompt layers are long-form on purpose. A style direction that has to fit in
 * a short field turns into keyword soup, which is exactly the failure the
 * layered prompt architecture exists to avoid.
 */
const promptLayerSchema = z
  .string()
  .trim()
  .max(4000, "Keep each prompt under 4000 characters.");

export const stylePresetNameSchema = z
  .string()
  .trim()
  .min(2, "Give the style a name of at least 2 characters.")
  .max(80, "Style names must be 80 characters or fewer.");

/**
 * The positive prompt is the one layer that must not be empty. Everything else
 * has a defensible blank state: no description, nothing to exclude. A preset
 * with no positive direction contributes nothing to the image while still
 * appearing in the picker as though it did.
 */
export const stylePresetBodySchema = z.object({
  name: stylePresetNameSchema,
  description: z
    .string()
    .trim()
    .max(600, "Keep the description under 600 characters.")
    .default(""),
  positivePrompt: z
    .string()
    .trim()
    .min(10, "Describe the look in at least 10 characters.")
    .max(4000, "Keep each prompt under 4000 characters."),
  negativePrompt: promptLayerSchema.default(""),
  defaultAspectRatio: projectAspectRatioSchema,
});

export const createStylePresetSchema = stylePresetBodySchema;

/**
 * `expectedCurrentVersion` is the optimistic lock. Editing a preset appends a
 * version rather than overwriting one, so two people editing at once would
 * otherwise both succeed and the later save would silently win.
 */
export const updateStylePresetSchema = stylePresetBodySchema.extend({
  stylePresetId: z.uuid(),
  expectedCurrentVersion: z.coerce.number().int().positive(),
});

export const addStylePresetFromTemplateSchema = z.object({
  templateKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "That template key is not valid."),
});

export const archiveStylePresetSchema = z.object({
  stylePresetId: z.uuid(),
});

export type StylePresetBody = z.infer<typeof stylePresetBodySchema>;

export function readStylePresetBodyForm(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    positivePrompt: formData.get("positivePrompt"),
    negativePrompt: formData.get("negativePrompt") ?? "",
    defaultAspectRatio: formData.get("defaultAspectRatio"),
  };
}
