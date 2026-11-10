import "server-only";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import { requireElevenLabs } from "@/lib/elevenlabs/configuration";

export function speechCostRates(provider: string) {
  if (provider === "elevenlabs")
    return {
      costPerMillionCharactersCents:
        requireElevenLabs().ELEVENLABS_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
      minimumEstimateCents: 1,
    };
  const env = getSceneAudioEnvironment();
  return {
    costPerMillionCharactersCents:
      env.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
    minimumEstimateCents: env.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
  };
}
