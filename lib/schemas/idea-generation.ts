import { z } from "zod";
import { contentPlatformSchema } from "@/lib/schemas/title-generation";

/** How many idea cards a single generation may request/produce. */
export const MIN_IDEAS = 3;
export const MAX_IDEAS = 8;
export const DEFAULT_IDEAS = 5;

/** A single generated idea card (drives `zodTextFormat` structured output). */
export const generatedIdeaSchema = z.object({
  topic: z.string().min(1).max(300),
  targetAudience: z.string().min(1).max(300),
  tone: z.string().min(1).max(200),
  targetDurationSeconds: z.number().int().min(1).max(7200).nullable(),
  primaryPlatform: contentPlatformSchema,
  hookAngle: z.string().min(1).max(400),
  rationale: z.string().min(1).max(400),
  hookType: z.string().min(1).max(60),
});

export const ideaGenerationOutputSchema = z.object({
  ideas: z.array(generatedIdeaSchema).min(1).max(MAX_IDEAS),
});

export type GeneratedIdea = z.infer<typeof generatedIdeaSchema>;
export type IdeaGenerationOutput = z.infer<typeof ideaGenerationOutputSchema>;

/** Server-action input: generate idea cards for a niche. */
export const generateIdeasSchema = z.object({
  niche: z.string().trim().min(2).max(120),
  platform: contentPlatformSchema.optional(),
  tonePreference: z.string().trim().max(200).optional(),
  count: z.coerce
    .number()
    .int()
    .min(MIN_IDEAS)
    .max(MAX_IDEAS)
    .default(DEFAULT_IDEAS),
  requestNonce: z.string().min(1),
});

/** Server-action input: persist one chosen idea. */
export const saveIdeaSchema = z.object({
  niche: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(2000).default(""),
  targetAudience: z.string().trim().max(1000).default(""),
  tone: z.string().trim().max(500).default(""),
  targetDurationSeconds: z.coerce.number().int().min(1).max(7200).nullish(),
  primaryPlatform: contentPlatformSchema,
  hookAngle: z.string().trim().max(1000).default(""),
  rationale: z.string().trim().max(1000).default(""),
  hookType: z.string().trim().max(60).default(""),
  generationRunId: z.uuid().nullish(),
});

export const archiveIdeaSchema = z.object({ ideaId: z.uuid() });

/** Server-action input: copy a saved idea into a project's brief. */
export const applyIdeaToBriefSchema = z.object({
  projectId: z.uuid(),
  ideaId: z.uuid(),
});
