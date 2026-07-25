import type {
  AudioOutputFormat,
  SceneAudioAssetFormat,
  SceneAudioGeneration,
} from "@/db/schema";

export function sceneAudioFormatForUploadContentType(
  contentType: "audio/webm" | "audio/mp4",
): SceneAudioAssetFormat {
  return contentType === "audio/mp4" ? "m4a" : "webm";
}

export type AiGeneratedSceneAudioGeneration = SceneAudioGeneration & {
  idempotencyKey: string;
  requestFingerprint: string;
  provider: string;
  model: string;
  voice: string;
  speedScaledPercent: number;
  voicePresetId: string;
  format: AudioOutputFormat;
};

/**
 * Every AI-generated row is written with all of these fields populated by
 * createSceneAudioGenerationReservation; a user_recorded row never has a
 * Trigger run dispatched against it, so any generation reaching AI-only
 * code (the provider call, reconciliation) is guaranteed to satisfy this —
 * this only exists to make that guarantee explicit and type-checked rather
 * than assumed.
 */
export function assertAiGeneratedSceneAudio(
  generation: SceneAudioGeneration,
): asserts generation is AiGeneratedSceneAudioGeneration {
  if (generation.source !== "ai_generated")
    throw new Error(
      "SCENE_AUDIO_GENERATION_NOT_AI_GENERATED: expected an AI-generated row.",
    );
}
