import { z } from "zod";
export const AUDIO_FORMATS = [
  "mp3",
  "opus",
  "aac",
  "flac",
  "wav",
  "pcm",
] as const;
export const audioFormatSchema = z.enum(AUDIO_FORMATS);
export const voicePresetInputSchema = z.object({
  provider: z.enum(["openai", "gemini", "elevenlabs"]).default("openai"),
  name: z.string().trim().min(1).max(80),
  voice: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(64),
  instructions: z.string().trim().max(2000).default(""),
  speedScaledPercent: z.coerce.number().int().min(25).max(400).default(100),
  format: audioFormatSchema.default("mp3"),
  isDefault: z.coerce.boolean().default(false),
});

export const elevenLabsVoicesPageSchema = z.object({
  voices: z
    .array(
      z.object({ id: z.string().min(1).max(100), name: z.string().max(200) }),
    )
    .max(30),
  model: z.string().min(1).max(100),
  nextCursor: z.string().nullable(),
});
