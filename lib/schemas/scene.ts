import { z } from "zod";

export const sceneContentSchema = z.object({
  narrationText: z.string().min(1).max(10000),
  visualDescription: z.string().min(1).max(5000),
  locationDescription: z.string().min(1).max(2000),
  actionDescription: z.string().min(1).max(3000),
  cameraShot: z.string().min(1).max(100),
  cameraAngle: z.string().min(1).max(100),
  cameraMotion: z.string().min(1).max(100),
  emotionalTone: z.string().min(1).max(200),
  characterNames: z.array(z.string().min(1).max(100)).max(50),
  propNames: z.array(z.string().min(1).max(100)).max(50),
  continuityNotes: z.string().max(3000),
  estimatedDurationMilliseconds: z.number().int().positive(),
});

export const sceneAnalysisOutputSchema = z.object({
  scenes: z.array(sceneContentSchema).min(1).max(500),
});

export const approveScriptVersionSchema = z.object({
  projectId: z.uuid(),
  scriptVersionId: z.uuid(),
});

export const startSceneAnalysisSchema = approveScriptVersionSchema;

export const reconcileSceneAnalysisSchema = z.object({
  projectId: z.uuid(),
  analysisRunId: z.uuid(),
});

export const updateSceneSchema = sceneContentSchema.extend({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  expectedVersion: z.coerce.number().int().positive(),
});

export const approveSceneSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  expectedVersion: z.coerce.number().int().positive(),
});

export const approveAllScenesSchema = z.object({ projectId: z.uuid() });

export type SceneContent = z.infer<typeof sceneContentSchema>;
export type SceneAnalysisOutput = z.infer<typeof sceneAnalysisOutputSchema>;
