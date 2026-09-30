import { z } from "zod";
import { sceneVoiceDirectionSchema } from "@/lib/audio/voice-direction";

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

/**
 * A scene as a person edits it: its content plus how its narration should be
 * delivered.
 *
 * Kept apart from `sceneContentSchema` on purpose. That schema is also the
 * structured output the analysis model must fill, and adding delivery fields
 * there would change what every analysis asks the model for. Direction comes
 * from the creator — typed in the editor, pasted, or read from their script —
 * never invented by the model.
 */
export const editableSceneContentSchema = sceneContentSchema.extend(
  sceneVoiceDirectionSchema.shape,
);

export const approveScriptVersionSchema = z.object({
  projectId: z.uuid(),
  scriptVersionId: z.uuid(),
});

export const startSceneAnalysisSchema = approveScriptVersionSchema;

export const reconcileSceneAnalysisSchema = z.object({
  projectId: z.uuid(),
  analysisRunId: z.uuid(),
});

export const updateSceneSchema = editableSceneContentSchema.extend({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  expectedVersion: z.coerce.number().int().positive(),
});

export const createSceneSchema = editableSceneContentSchema.extend({
  projectId: z.uuid(),
});

/**
 * A pasted plan, carried as raw text rather than a parsed array.
 *
 * The browser sends what the creator pasted and the server decides what it
 * means. Parsing here would let a client that skipped validation post scenes
 * the real parser would have refused, and the error messages a person acts on
 * are worth generating once, on the side that is authoritative.
 */
export const importScenesSchema = z.object({
  projectId: z.uuid(),
  pasted: z.string().min(1).max(2_000_000),
});

export const approveSceneSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  expectedVersion: z.coerce.number().int().positive(),
});

export const approveAllScenesSchema = z.object({ projectId: z.uuid() });

/**
 * Deleting takes a scene id and nothing else.
 *
 * No expected version: a revision conflict is a reason to refuse a *save*,
 * because the creator would overwrite someone's work. Refusing a delete on the
 * same grounds would only mean deleting the scene a moment later, having made
 * the person reload first.
 */
export const deleteSceneSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
});

/**
 * Which scene lives on, and which is absorbed into it.
 *
 * No expected versions, for the same reason the delete carries none: the server
 * re-reads both scenes, and the merge statement re-checks that they are still
 * neighbours in the same analysis run before it changes anything. A stale
 * version number from the browser would only make a creator reload first.
 */
export const mergeScenesSchema = z.object({
  projectId: z.uuid(),
  survivorSceneId: z.uuid(),
  absorbedSceneId: z.uuid(),
});

export type SceneContent = z.infer<typeof sceneContentSchema>;
export type EditableSceneContent = z.infer<typeof editableSceneContentSchema>;
export type SceneAnalysisOutput = z.infer<typeof sceneAnalysisOutputSchema>;
