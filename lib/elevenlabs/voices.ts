import "server-only";
import { ElevenLabsPresetError } from "./errors";
import { z } from "zod";
import { elevenLabsJson } from "./client";
import { requireElevenLabs } from "./configuration";

export async function listElevenLabsVoices(cursor?: string) {
  requireElevenLabs();
  const pageToken = z.string().max(500).optional().parse(cursor);
  const params = new URLSearchParams({ page_size: "30" });
  if (pageToken) params.set("next_page_token", pageToken);
  const result = z
    .object({
      voices: z
        .array(
          z.object({
            voice_id: z.string().max(100),
            name: z.string().max(200),
            category: z.string().optional(),
          }),
        )
        .max(30),
      has_more: z.boolean(),
      next_page_token: z.string().nullish(),
    })
    .parse(await elevenLabsJson(`/v2/voices?${params}`));
  return {
    voices: result.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category ?? "account",
    })),
    nextCursor: result.has_more ? (result.next_page_token ?? null) : null,
  };
}
export async function validateElevenLabsPreset(input: {
  voice: string;
  model: string;
  format: string;
  speedScaledPercent: number;
  instructions: string;
}) {
  const env = requireElevenLabs();
  if (
    input.model !== env.ELEVENLABS_TTS_MODEL ||
    !["mp3", "wav", "opus"].includes(input.format) ||
    input.speedScaledPercent < 70 ||
    input.speedScaledPercent > 120
  )
    throw new ElevenLabsPresetError(
      "Choose the configured ElevenLabs model, MP3/WAV/Opus and 70–120% speed.",
    );
  if (input.instructions.trim())
    throw new ElevenLabsPresetError(
      "ElevenLabs does not accept the free-form narration instructions used by the other providers. Leave that field empty.",
    );
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(input.voice))
    throw new ElevenLabsPresetError("Invalid ElevenLabs voice.");
  const voice = z
    .object({ voice_id: z.string() })
    .parse(await elevenLabsJson(`/v1/voices/${input.voice}`));
  if (voice.voice_id !== input.voice)
    throw new ElevenLabsPresetError("The ElevenLabs voice is unavailable.");
}
