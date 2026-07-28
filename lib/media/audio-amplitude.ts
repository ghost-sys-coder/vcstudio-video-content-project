import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
  AMPLITUDE_SCALE,
} from "@/lib/media/amplitude-envelope";

const execFileAsync = promisify(execFile);

// Speech loudness doesn't need a high sample rate to measure — this only
// drives a binary talk-open/talk-closed threshold, not frequency content.
const PCM_SAMPLE_RATE_HZ = 8000;

function isMissingBinaryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (Reflect.get(error, "code") === "ENOENT" ||
      Reflect.get(error, "code") === "EACCES")
  );
}

/**
 * Peak-normalized amplitude (0..`AMPLITUDE_SCALE`, where the scale maximum is
 * the loudest moment anywhere in the clip) for each of `sampleCount` equal
 * windows at `samplesPerSecond`, read directly off mono 16-bit PCM samples.
 * Pure and synchronous so it is unit-testable without ffmpeg.
 */
export function computeAmplitudeEnvelopeFromPcm(input: {
  pcm: Buffer;
  sampleRate: number;
  sampleCount: number;
  samplesPerSecond: number;
}): number[] {
  const pcmSampleCount = Math.floor(input.pcm.length / 2);
  let peakAbs = 0;
  for (let i = 0; i < pcmSampleCount; i++) {
    const value = Math.abs(input.pcm.readInt16LE(i * 2));
    if (value > peakAbs) peakAbs = value;
  }
  if (peakAbs === 0) return new Array(input.sampleCount).fill(0);

  const envelope = new Array(input.sampleCount).fill(0);
  for (let index = 0; index < input.sampleCount; index++) {
    const startSample = Math.floor(
      (index / input.samplesPerSecond) * input.sampleRate,
    );
    const endSample = Math.min(
      pcmSampleCount,
      Math.floor(((index + 1) / input.samplesPerSecond) * input.sampleRate),
    );
    let maxAbs = 0;
    for (let sample = startSample; sample < endSample; sample++) {
      const value = Math.abs(input.pcm.readInt16LE(sample * 2));
      if (value > maxAbs) maxAbs = value;
    }
    envelope[index] = Math.round((maxAbs / peakAbs) * AMPLITUDE_SCALE);
  }
  return envelope;
}

/**
 * Decodes encoded narration audio with ffmpeg into a fixed-rate amplitude
 * envelope, or null when ffmpeg is unavailable or the audio could not be
 * decoded.
 *
 * Computed once, when the narration audio is produced, and stored alongside it.
 * That placement matters twice over: the browser preview cannot shell out to
 * ffmpeg at all (and fetching raw audio bytes in-browser is blocked by the
 * asset bucket's missing CORS headers, which previously crashed every animated
 * render), and the render worker would otherwise redo this decode on every
 * attempt. ffmpeg is always invoked with an argument array, never a shell
 * string.
 */
export async function computeAudioAmplitudeEnvelope(input: {
  bytes: Buffer;
  extension: string;
  ffmpegPath: string;
  timeoutMilliseconds?: number;
}): Promise<number[] | null> {
  const directory = await mkdtemp(join(tmpdir(), "vcstudio-amplitude-"));
  const safeExtension = input.extension.replace(/[^a-z0-9]/gi, "") || "bin";
  const inputPath = join(directory, `input.${safeExtension}`);
  const outputPath = join(directory, "output.pcm");
  try {
    await writeFile(inputPath, input.bytes);
    await execFileAsync(
      input.ffmpegPath,
      [
        "-v",
        "error",
        "-y",
        "-i",
        inputPath,
        "-f",
        "s16le",
        "-ac",
        "1",
        "-ar",
        String(PCM_SAMPLE_RATE_HZ),
        outputPath,
      ],
      {
        timeout: input.timeoutMilliseconds ?? 30_000,
        windowsHide: true,
      },
    );
    const pcm = await readFile(outputPath);
    if (pcm.length < 2) return null;
    const durationSeconds = pcm.length / 2 / PCM_SAMPLE_RATE_HZ;
    return computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: PCM_SAMPLE_RATE_HZ,
      sampleCount: Math.max(
        1,
        Math.ceil(durationSeconds * AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ),
      ),
      samplesPerSecond: AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
    });
  } catch (error) {
    if (isMissingBinaryError(error)) return null;
    // A decode failure (corrupt/unsupported audio) degrades to no amplitude
    // data rather than failing the render — the character still renders, just
    // idling instead of lip-syncing.
    return null;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
