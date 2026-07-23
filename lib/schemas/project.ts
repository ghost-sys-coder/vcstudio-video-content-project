import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "planning",
  "assetGeneration",
  "review",
  "readyToRender",
  "rendering",
  "completed",
  "failed",
  "archived",
]);

export const projectAspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);

export const projectIdSchema = z.object({ projectId: z.uuid() });

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).default(""),
  aspectRatio: projectAspectRatioSchema,
  framesPerSecond: z.coerce.number().int().min(1).max(120),
  language: z.string().trim().min(2).max(40),
  maximumBudgetCents: z.coerce.number().int().min(0).max(100000),
});

export const updateProjectSchema = createProjectSchema.extend({
  projectId: z.uuid(),
  status: projectStatusSchema,
});

export const contentPlatformSchema = z.enum([
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
]);

export const briefSchema = z.object({
  projectId: z.uuid(),
  topic: z.string().trim().max(2000).default(""),
  targetAudience: z.string().trim().max(1000).default(""),
  tone: z.string().trim().max(500).default(""),
  targetDurationSeconds: z.coerce.number().int().min(1).max(7200).nullish(),
  primaryPlatform: contentPlatformSchema,
  hookAngle: z.string().trim().max(1000).default(""),
  niche: z.string().trim().max(120).default(""),
});

export const scriptMutationSchema = z.object({
  projectId: z.uuid(),
  content: z.string(),
  revision: z.coerce.number().int().min(0),
});

export function createScriptContentSchema(maximumCharacters: number) {
  return z
    .string()
    .max(
      maximumCharacters,
      `Script must be ${maximumCharacters.toLocaleString()} characters or fewer.`,
    );
}

export const createScriptVersionSchema = z.object({
  projectId: z.uuid(),
  revision: z.coerce.number().int().min(0),
});

export const restoreScriptVersionSchema = z.object({
  projectId: z.uuid(),
  versionId: z.uuid(),
  revision: z.coerce.number().int().min(0),
});

export const deleteScriptVersionSchema = z.object({
  projectId: z.uuid(),
  versionId: z.uuid(),
});

export function getProjectDimensions(
  aspectRatio: z.infer<typeof projectAspectRatioSchema>,
) {
  if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}
