import { z } from "zod";

const commonMetadataSchema = z.object({
  durationMilliseconds: z.number().int().positive(),
  container: z.string().min(1),
});

export const verifiedAudioMetadataSchema = commonMetadataSchema.extend({
  kind: z.literal("audio"),
  codec: z.string().min(1),
  channels: z.number().int().positive(),
  sampleRate: z.number().int().positive(),
  silenceRatio: z.number().min(0).max(1),
  clippingRatio: z.number().min(0).max(1),
});

export const verifiedVideoMetadataSchema = commonMetadataSchema.extend({
  kind: z.literal("video"),
  codec: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  displayWidth: z.number().int().positive(),
  displayHeight: z.number().int().positive(),
  rotationDegrees: z.number().int(),
  averageFrameRate: z.number().positive(),
  variableFrameRate: z.boolean(),
  hasAudio: z.boolean(),
  audioCodec: z.string().min(1).nullable(),
});

export const verifiedMediaMetadataSchema = z.discriminatedUnion("kind", [
  verifiedAudioMetadataSchema,
  verifiedVideoMetadataSchema,
]);

export type VerifiedMediaMetadata = z.infer<typeof verifiedMediaMetadataSchema>;

export type MediaInspectionResult = {
  metadata: VerifiedMediaMetadata;
  warnings: string[];
  amplitudeEnvelope: number[] | null;
};

export function analyzePcmQuality(pcm: Buffer): {
  silenceRatio: number;
  clippingRatio: number;
  warnings: string[];
} {
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount === 0)
    return {
      silenceRatio: 1,
      clippingRatio: 0,
      warnings: ["The recording contains no decodable audio samples."],
    };
  let silent = 0;
  let clipped = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const absolute = Math.abs(pcm.readInt16LE(index * 2));
    if (absolute <= 328) silent += 1;
    if (absolute >= 32_700) clipped += 1;
  }
  const silenceRatio = silent / sampleCount;
  const clippingRatio = clipped / sampleCount;
  const warnings: string[] = [];
  if (silenceRatio >= 0.9)
    warnings.push(
      "The recording is mostly silent. Record again closer to the microphone.",
    );
  if (clippingRatio >= 0.01)
    warnings.push(
      "The recording is severely clipped. Lower the microphone input level and record again.",
    );
  return { silenceRatio, clippingRatio, warnings };
}

export function evaluateUsableAudioDuration(durationMilliseconds: number) {
  if (durationMilliseconds < 500)
    return "The recording is too short to use. Record at least half a second.";
  if (durationMilliseconds > 30 * 60 * 1000)
    return "The recording is longer than the supported 30-minute limit.";
  return null;
}
