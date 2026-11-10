import "server-only";
import { z } from "zod";
import {
  STANDALONE_IMAGE_PROMPT_VERSION,
  renderStandaloneImagePrompt,
} from "@studio/prompts";
import {
  MAX_STANDALONE_AUDIO_SEGMENTS,
  type McpGenerationRequest,
} from "@studio/contracts/mcp-generation";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { findVoicePreset } from "@/db/repositories/scene-audio.repository";
import {
  getSceneImageEnvironment,
  getSceneAudioEnvironment,
  getSpeechProviderEnvironment,
} from "@/lib/env/server";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import {
  createSceneImageOutputCostMatrix,
  getSceneImageCompression,
} from "@/lib/scenes/scene-image-configuration";
import { sceneImageProviderConfigurationSchema } from "@/lib/schemas/scene-image";
import { createSpeechProvider } from "@/lib/speech/create-speech-provider";
import { buildSceneNarrationInput } from "@/lib/audio/narration-input";
import {
  composeVoiceInstructions,
  EMPTY_VOICE_DIRECTION,
} from "@/lib/audio/voice-direction";
import { extractRaisedPhrases } from "@/lib/audio/narration-directives";
import { mcpObjectEtag } from "./storage-integrity";
import { requireMcp } from "./errors";

const referenceSchema = z.object({
  id: z.uuid(),
  objectKey: z.string(),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().positive(),
  etag: z.string(),
});
const base = z.object({
  estimatedCostCents: z.number().int().positive(),
  promptTemplateVersion: z.string(),
});
export const standaloneGenerationPlanSchema = z.discriminatedUnion("kind", [
  base.extend({
    kind: z.literal("image"),
    configuration: sceneImageProviderConfigurationSchema,
    references: z.array(referenceSchema).max(16),
    rates: z.object({
      textInputCostPerMillionCents: z.number(),
      imageInputCostPerMillionCents: z.number(),
      outputCostPerMillionCents: z.number(),
    }),
  }),
  base.extend({
    kind: z.literal("audio"),
    segmentCount: z.number().int().min(1).max(MAX_STANDALONE_AUDIO_SEGMENTS),
    text: z.string(),
    provider: z.enum(["openai", "gemini"]),
    model: z.string(),
    voice: z.string(),
    format: z.enum(["mp3", "wav", "opus"]),
    speedScaledPercent: z.number().int(),
    instructions: z.string(),
    language: z.string(),
    voicePresetId: z.uuid(),
    voiceRevision: z.string(),
    rates: z.object({
      costPerMillionCharactersCents: z.number(),
      minimumEstimateCents: z.number(),
    }),
  }),
]);
export type StandaloneGenerationPlan = z.infer<
  typeof standaloneGenerationPlanSchema
>;

export async function buildStandaloneGenerationPlan(
  workspaceId: string,
  request: Extract<McpGenerationRequest, { kind: "image" | "audio" }>,
): Promise<StandaloneGenerationPlan> {
  if (request.kind === "image") {
    const env = getSceneImageEnvironment();
    requireMcp(
      env.ENABLE_SCENE_IMAGE_GENERATION,
      "feature_disabled",
      "Image generation is disabled.",
    );
    requireMcp(
      request.referenceAssetIds.length <=
        env.MAX_REFERENCE_ASSETS_PER_GENERATION,
      "invalid_input",
      "Too many image references.",
    );
    const assets = request.referenceAssetIds.length
      ? await findReadyMediaAssets({
          workspaceId,
          mediaAssetIds: request.referenceAssetIds,
        })
      : [];
    requireMcp(
      assets.length === request.referenceAssetIds.length &&
        assets.every(
          (a) =>
            a.kind === "image" &&
            a.objectKey.startsWith(`workspaces/${workspaceId}/`),
        ),
      "invalid_media",
      "Choose ready images in this workspace as references.",
    );
    requireMcp(
      assets.reduce((n, a) => n + a.sizeBytes, 0) <=
        env.MAX_REFERENCE_BYTES_PER_GENERATION,
      "invalid_media",
      "The reference images exceed the generation size limit.",
    );
    const references = await Promise.all(
      assets
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(async (a) =>
          referenceSchema.parse({
            id: a.id,
            objectKey: a.objectKey,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
            etag: await mcpObjectEtag(a.objectKey),
          }),
        ),
    );
    const prompt = renderStandaloneImagePrompt(request.prompt);
    const estimate = estimateSceneImageCost({
      prompt,
      quality: request.quality,
      size: request.size,
      referenceAssetCount: references.length,
      outputCostMatrix: createSceneImageOutputCostMatrix(env),
      textInputCostPerMillionCents:
        env.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
      referenceInputReserveCents:
        env.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
      safetyMarginBasisPoints: 0,
    });
    return {
      kind: "image",
      promptTemplateVersion: STANDALONE_IMAGE_PROMPT_VERSION,
      estimatedCostCents: estimate.estimatedCostCents,
      configuration: {
        model: env.OPENAI_IMAGE_MODEL,
        prompt,
        quality: request.quality,
        size: request.size,
        outputFormat: env.OPENAI_IMAGE_OUTPUT_FORMAT,
        outputCompression: getSceneImageCompression(env, request.quality),
        background: env.OPENAI_IMAGE_BACKGROUND,
      },
      references,
      rates: {
        textInputCostPerMillionCents:
          env.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
        imageInputCostPerMillionCents:
          env.OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          env.OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS,
      },
    };
  }
  const env = getSceneAudioEnvironment();
  requireMcp(
    env.ENABLE_SCENE_AUDIO_GENERATION,
    "feature_disabled",
    "Audio generation is disabled.",
  );
  const preset = await findVoicePreset({
    workspaceId,
    voicePresetId: request.voicePresetId,
  });
  requireMcp(
    preset &&
      !preset.customVoiceId &&
      (preset.provider === "openai" || preset.provider === "gemini"),
    "invalid_input",
    "Choose an existing OpenAI or Gemini catalogue voice preset. Custom voices remain available in the scene pipeline.",
  );
  const provider = preset.provider === "gemini" ? "gemini" : "openai";
  requireMcp(
    ["mp3", "wav", "opus"].includes(preset.format),
    "invalid_input",
    "Choose an MP3, WAV or Opus voice preset for library audio.",
  );
  const model =
    provider === "openai"
      ? env.OPENAI_TTS_MODEL
      : getSpeechProviderEnvironment().GEMINI_TTS_MODEL;
  requireMcp(
    preset.model === model,
    "invalid_input",
    "Update this voice preset to the currently configured model before generating library audio.",
  );
  const speech = createSpeechProvider(provider);
  const narration = buildSceneNarrationInput({
    narrationText: request.text,
    maximumCharacters: Math.min(
      speech.maximumCharacters,
      env.MAX_NARRATION_CHARACTERS,
    ),
  });
  const rates = {
    costPerMillionCharactersCents:
      env.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
    minimumEstimateCents: env.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
  };
  const speechParts = narration.parts.filter((part) => part.kind === "speech");
  requireMcp(
    speechParts.length <= MAX_STANDALONE_AUDIO_SEGMENTS,
    "invalid_input",
    `Use at most ${MAX_STANDALONE_AUDIO_SEGMENTS} spoken segments per library audio generation. Reduce pause markers or split the request.`,
  );
  return standaloneGenerationPlanSchema.parse({
    kind: "audio",
    segmentCount: speechParts.length,
    promptTemplateVersion: "voice-preset-v1",
    text: narration.text,
    provider,
    model,
    voice: preset.voice,
    format: preset.format,
    speedScaledPercent: preset.speedScaledPercent,
    instructions: composeVoiceInstructions({
      presetInstructions: preset.instructions,
      direction: EMPTY_VOICE_DIRECTION,
      raisedPhrases: extractRaisedPhrases(narration.text),
    }),
    language: request.language,
    voicePresetId: preset.id,
    voiceRevision: preset.updatedAt.toISOString(),
    rates,
    estimatedCostCents: speechParts.reduce(
      (sum, part) =>
        sum +
        estimateSceneAudioCostCents({
          characterCount: part.text.length,
          rates,
        }),
      0,
    ),
  });
}
