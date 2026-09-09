import { z } from "zod";

const ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

/**
 * The editable body of a format. Every field is validated the same way the
 * project that inherits it would be, so a preset can never seed a project with
 * values the project itself would reject.
 */
export const formatPresetVersionInputSchema = z.object({
  audienceDescription: z.string().trim().max(2000).default(""),
  editorialStructure: z.string().trim().max(2000).default(""),
  targetDurationSeconds: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60)
    .nullable()
    .default(null),
  aspectRatio: z.enum(ASPECT_RATIOS),
  framesPerSecond: z.coerce.number().int().min(1).max(120).default(30),
  voicePresetId: z
    .union([z.uuid(), z.literal("")])
    .nullable()
    .default(null),
  stylePresetId: z
    .union([z.uuid(), z.literal("")])
    .nullable()
    .default(null),
  captionsEnabled: z.coerce.boolean().default(true),
  /**
   * A starting budget only. It is capped at the same ceiling the project form
   * enforces so a preset cannot raise a workspace's spending limits, and
   * generation still runs its own estimate, budget check and confirmation.
   */
  defaultMaximumBudgetCents: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .default(null),
});

export const createFormatPresetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channelProfileId: z.union([z.uuid(), z.literal("")]).optional(),
  ...formatPresetVersionInputSchema.shape,
});

export const publishFormatPresetVersionSchema = z.object({
  formatPresetId: z.uuid(),
  ...formatPresetVersionInputSchema.shape,
});

export const archiveFormatPresetSchema = z.object({
  formatPresetId: z.uuid(),
});

export const ideaBacklogSchema = z.object({
  ideaId: z.uuid(),
  channelProfileId: z.union([z.uuid(), z.literal("")]).optional(),
  formatPresetId: z.union([z.uuid(), z.literal("")]).optional(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  plannedReleaseAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value) : null))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), {
      message: "Provide a valid release date.",
    }),
});

export type FormatPresetVersionInput = z.infer<
  typeof formatPresetVersionInputSchema
>;

export function createFormatPresetSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "format"
  );
}
