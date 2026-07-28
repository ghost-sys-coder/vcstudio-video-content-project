import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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
 * Peak-normalized amplitude (0..1, 1 = the loudest moment anywhere in the
 * clip) for each of `frameCount` equal-length windows at `framesPerSecond`,
 * read directly off mono 16-bit PCM samples at `sampleRate`. Pure and
 * synchronous so it is unit-testable without ffmpeg.
 */
export function computeAmplitudeEnvelopeFromPcm(input: {
  pcm: Buffer;
  sampleRate: number;
  frameCount: number;
  framesPerSecond: number;
}): number[] {
  const sampleCount = Math.floor(input.pcm.length / 2);
  let peakAbs = 0;
  for (let i = 0; i < sampleCount; i++) {
    const value = Math.abs(input.pcm.readInt16LE(i * 2));
    if (value > peakAbs) peakAbs = value;
  }
  if (peakAbs === 0) return new Array(input.frameCount).fill(0);

  const envelope = new Array(input.frameCount).fill(0);
  for (let frame = 0; frame < input.frameCount; frame++) {
    const startSample = Math.floor(
      (frame / input.framesPerSecond) * input.sampleRate,
    );
    const endSample = Math.min(
      sampleCount,
      Math.floor(((frame + 1) / input.framesPerSecond) * input.sampleRate),
    );
    let maxAbs = 0;
    for (let sample = startSample; sample < endSample; sample++) {
      const value = Math.abs(input.pcm.readInt16LE(sample * 2));
      if (value > maxAbs) maxAbs = value;
    }
    envelope[frame] = maxAbs / peakAbs;
  }
  return envelope;
}

/**
 * Decodes encoded narration audio with ffmpeg and returns a per-frame
 * amplitude envelope, or null when ffmpeg itself is unavailable or the audio
 * could not be decoded. This exists so animated-character lip-sync timing is
 * measured server-side, once, at render time — never by fetching raw audio
 * bytes from the browser during rendering (that fetch requires the asset
 * bucket to serve CORS headers it doesn't have, which previously crashed
 * every render containing an animated character). ffmpeg is always invoked
 * with an argument array, never a shell string.
 */
export async function computeAudioAmplitudeEnvelope(input: {
  bytes: Buffer;
  extension: string;
  ffmpegPath: string;
  frameCount: number;
  framesPerSecond: number;
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
    return computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: PCM_SAMPLE_RATE_HZ,
      frameCount: input.frameCount,
      framesPerSecond: input.framesPerSecond,
    });
  } catch (error) {
    if (isMissingBinaryError(error)) return null;
    // A decode failure (corrupt/unsupported audio) degrades to no amplitude
    // data rather than failing the render — the animated character still
    // renders, just without measured lip-sync for this scene.
    return null;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
