import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { computeAmplitudeEnvelopeFromPcm } from "@/lib/media/audio-amplitude";
import { AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ } from "@/lib/media/amplitude-envelope";
import {
  analyzePcmQuality,
  evaluateUsableAudioDuration,
  type MediaInspectionResult,
} from "@/lib/media/media-inspection";

const execFileAsync = promisify(execFile);
const PCM_SAMPLE_RATE = 8_000;

const streamSchema = z.object({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  channels: z.number().optional(),
  sample_rate: z.string().optional(),
  duration: z.string().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
  side_data_list: z
    .array(z.object({ rotation: z.number().optional() }).passthrough())
    .optional(),
});

const probeSchema = z.object({
  format: z
    .object({
      duration: z.string().optional(),
      format_name: z.string().optional(),
    })
    .optional(),
  streams: z.array(streamSchema).default([]),
});

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ratio(value: string | undefined): number | null {
  if (!value) return null;
  const [numerator, denominator] = value.split("/").map(Number);
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    !denominator
  )
    return null;
  const result = numerator! / denominator!;
  return result > 0 ? result : null;
}

function durationMilliseconds(probe: z.infer<typeof probeSchema>): number {
  const duration =
    positiveNumber(probe.format?.duration) ??
    probe.streams
      .map((stream) => positiveNumber(stream.duration))
      .find(Boolean) ??
    null;
  if (duration === null) throw new Error("MEDIA_DURATION_UNAVAILABLE");
  return Math.round(duration * 1000);
}

function rotation(stream: z.infer<typeof streamSchema>): number {
  const value =
    stream.side_data_list?.find((item) => item.rotation !== undefined)
      ?.rotation ?? Number(stream.tags?.rotate ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 360) + 360) % 360;
}

export async function inspectMediaFile(input: {
  bytes: Buffer;
  extension: string;
  expectedKind: "audio" | "video";
  ffprobePath: string;
  ffmpegPath: string;
}): Promise<MediaInspectionResult> {
  const directory = await mkdtemp(join(tmpdir(), "vcstudio-inspection-"));
  const extension = input.extension.replace(/[^a-z0-9]/gi, "") || "bin";
  const source = join(directory, `source.${extension}`);
  try {
    await writeFile(source, input.bytes);
    const { stdout } = await execFileAsync(
      input.ffprobePath,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        source,
      ],
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    const probe = probeSchema.parse(JSON.parse(stdout) as unknown);
    const duration = durationMilliseconds(probe);
    const container = probe.format?.format_name?.split(",")[0] || "unknown";
    if (input.expectedKind === "video") {
      const video = probe.streams.find(
        (stream) => stream.codec_type === "video",
      );
      if (!video?.codec_name || !video.width || !video.height)
        throw new Error("VIDEO_STREAM_UNAVAILABLE");
      const averageFrameRate =
        ratio(video.avg_frame_rate) ?? ratio(video.r_frame_rate);
      if (!averageFrameRate) throw new Error("VIDEO_FRAME_RATE_UNAVAILABLE");
      const nominalFrameRate = ratio(video.r_frame_rate) ?? averageFrameRate;
      const rotationDegrees = rotation(video);
      const rotated = rotationDegrees === 90 || rotationDegrees === 270;
      const audio = probe.streams.find(
        (stream) => stream.codec_type === "audio",
      );
      const warnings: string[] = [];
      if (!audio) warnings.push("The video has no audio track.");
      if (Math.abs(averageFrameRate - nominalFrameRate) > 0.01)
        warnings.push(
          "The video uses a variable frame rate; transcode to constant frame rate if a destination rejects it.",
        );
      return {
        metadata: {
          kind: "video",
          durationMilliseconds: duration,
          container,
          codec: video.codec_name,
          width: video.width,
          height: video.height,
          displayWidth: rotated ? video.height : video.width,
          displayHeight: rotated ? video.width : video.height,
          rotationDegrees,
          averageFrameRate,
          variableFrameRate:
            Math.abs(averageFrameRate - nominalFrameRate) > 0.01,
          hasAudio: Boolean(audio),
          audioCodec: audio?.codec_name ?? null,
        },
        warnings,
        amplitudeEnvelope: null,
      };
    }

    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    const sampleRate = positiveNumber(audio?.sample_rate);
    if (!audio?.codec_name || !audio.channels || !sampleRate)
      throw new Error("AUDIO_STREAM_UNAVAILABLE");
    const pcmPath = join(directory, "audio.pcm");
    await execFileAsync(
      input.ffmpegPath,
      [
        "-v",
        "error",
        "-y",
        "-i",
        source,
        "-f",
        "s16le",
        "-ac",
        "1",
        "-ar",
        String(PCM_SAMPLE_RATE),
        pcmPath,
      ],
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    const pcm = await readFile(pcmPath);
    const quality = analyzePcmQuality(pcm);
    const durationWarning = evaluateUsableAudioDuration(duration);
    const envelope = computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: PCM_SAMPLE_RATE,
      sampleCount: Math.max(
        1,
        Math.ceil((duration / 1000) * AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ),
      ),
      samplesPerSecond: AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
    });
    return {
      metadata: {
        kind: "audio",
        durationMilliseconds: duration,
        container,
        codec: audio.codec_name,
        channels: audio.channels,
        sampleRate: Math.round(sampleRate),
        silenceRatio: quality.silenceRatio,
        clippingRatio: quality.clippingRatio,
      },
      warnings: [
        ...quality.warnings,
        ...(durationWarning ? [durationWarning] : []),
      ],
      amplitudeEnvelope: envelope,
    };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}
