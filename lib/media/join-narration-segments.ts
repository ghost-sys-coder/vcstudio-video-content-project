import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";

const execFileAsync = promisify(execFile);

/** Both speech providers produce 24 kHz mono. */
export const NARRATION_SAMPLE_RATE_HZ = 24_000;

/**
 * A spoken clip on disk, or a silence of exact length. `trimStart` and
 * `trimEnd` remove the clip's own quiet edge where it meets a pause.
 */
export type NarrationJoinItem =
  | {
      kind: "clip";
      path: string;
      trimStart?: boolean;
      trimEnd?: boolean;
      /** Turns the clip up (or down) by this many decibels. */
      gainDb?: number;
    }
  | { kind: "silence"; milliseconds: number };

/**
 * Quieter than speech, louder than a clean digital silence. A voice clip's
 * lead-in and tail sit well below this; a soft consonant does not.
 */
const EDGE_SILENCE_THRESHOLD = "-50dB";
/** Kept of each trimmed edge, so a word is never cut at its first sample. */
const EDGE_SILENCE_KEPT_SECONDS = "0.03";

/**
 * The break a narrator takes between sentences anyway, measured on this
 * pipeline's own output at 0.45–0.55 s. A written pause is added on top of it.
 *
 * Without it, `[PAUSE: 0.5s]` came out exactly as long as an ordinary sentence
 * break and could not be heard as a pause at all: the voice's own edge silence
 * is trimmed where a clip meets a pause, and 0.5 s alone merely put back what
 * was removed. A pause is a deliberate beat beyond normal delivery, so the
 * written length is how much longer than a normal break it lasts.
 */
export const NATURAL_BREAK_MILLISECONDS = 450;

/** About −1 dBFS: the loudest a boosted clip may peak. */
const BOOST_PEAK_LIMIT = "0.89";

const TRIM_LEADING = `silenceremove=start_periods=1:start_threshold=${EDGE_SILENCE_THRESHOLD}:start_silence=${EDGE_SILENCE_KEPT_SECONDS}`;

const ENCODER_ARGUMENTS: Record<SceneAudioFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3"],
  opus: ["-c:a", "libopus", "-b:a", "64k", "-f", "ogg"],
  aac: ["-c:a", "aac", "-b:a", "128k", "-f", "adts"],
  flac: ["-c:a", "flac", "-f", "flac"],
  wav: ["-c:a", "pcm_s16le", "-f", "wav"],
  pcm: ["-c:a", "pcm_s16le", "-f", "s16le"],
};

/**
 * The ffmpeg arguments that play each clip in order, with each silence in
 * between, as one file in the requested format.
 *
 * Silence is generated rather than recorded, so every pause has a predictable
 * length: the narrator's natural break plus the written duration. A voice model
 * leaves its own quiet lead-in and tail on every clip, of varying length, so
 * each clip's edge is trimmed where it meets a pause (and only there: the
 * scene's own opening and ending are left as the model made them) and the
 * natural break is put back at a consistent length. Every clip is resampled to one rate and channel
 * layout first, because concatenation refuses streams that differ. Built as an
 * argument array, never a shell string.
 */
export function buildNarrationJoinArguments(input: {
  items: NarrationJoinItem[];
  format: SceneAudioFormat;
  outputPath: string;
}): string[] {
  const inputs: string[] = [];
  const filters: string[] = [];
  const labels: string[] = [];
  let clipIndex = 0;
  input.items.forEach((item, position) => {
    const label = `a${position}`;
    if (item.kind === "clip") {
      inputs.push("-i", item.path);
      const chain = [
        `aresample=${NARRATION_SAMPLE_RATE_HZ}`,
        "aformat=sample_fmts=s16:channel_layouts=mono",
        ...(item.trimStart ? [TRIM_LEADING] : []),
        // A trailing edge is trimmed as a leading one, on the reversed clip.
        ...(item.trimEnd ? ["areverse", TRIM_LEADING, "areverse"] : []),
        // A boost is followed by a limiter: a voice already peaking near full
        // scale, turned up 4 dB, otherwise clips audibly on its loudest word.
        ...(item.gainDb !== undefined && Number.isFinite(item.gainDb)
          ? [
              `volume=${Math.max(-12, Math.min(12, item.gainDb)).toFixed(1)}dB`,
              `alimiter=limit=${BOOST_PEAK_LIMIT}:level=0`,
            ]
          : []),
      ];
      filters.push(`[${clipIndex}:a]${chain.join(",")}[${label}]`);
      clipIndex += 1;
    } else {
      const seconds = (
        (item.milliseconds + NATURAL_BREAK_MILLISECONDS) /
        1_000
      ).toFixed(3);
      filters.push(
        `anullsrc=r=${NARRATION_SAMPLE_RATE_HZ}:cl=mono,atrim=duration=${seconds},aformat=sample_fmts=s16:channel_layouts=mono[${label}]`,
      );
    }
    labels.push(`[${label}]`);
  });
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[out]`);
  return [
    "-v",
    "error",
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-ar",
    String(NARRATION_SAMPLE_RATE_HZ),
    "-ac",
    "1",
    ...ENCODER_ARGUMENTS[input.format],
    input.outputPath,
  ];
}

export class NarrationJoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NarrationJoinError";
  }
}

/**
 * Joins spoken clips and silences into one narration file.
 *
 * Clips arrive as WAV, whatever the preset's final format: WAV decodes without
 * guessing, and the single re-encode happens here, once, into the format the
 * scene asked for.
 */
export async function joinNarrationSegments(input: {
  parts: (
    | { kind: "clip"; bytes: Buffer; gainDb?: number }
    | { kind: "silence"; milliseconds: number }
  )[];
  format: SceneAudioFormat;
  ffmpegPath: string;
  timeoutMilliseconds?: number;
}): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "vcstudio-narration-"));
  try {
    const items: NarrationJoinItem[] = [];
    let clip = 0;
    for (const [index, part] of input.parts.entries()) {
      if (part.kind === "silence") {
        items.push(part);
        continue;
      }
      const path = join(directory, `clip-${clip}.wav`);
      clip += 1;
      await writeFile(path, part.bytes);
      items.push({
        kind: "clip",
        path,
        trimStart: input.parts[index - 1]?.kind === "silence",
        trimEnd: input.parts[index + 1]?.kind === "silence",
        ...(part.gainDb !== undefined ? { gainDb: part.gainDb } : {}),
      });
    }
    const outputPath = join(directory, "narration.out");
    try {
      await execFileAsync(
        input.ffmpegPath,
        buildNarrationJoinArguments({
          items,
          format: input.format,
          outputPath,
        }),
        { timeout: input.timeoutMilliseconds ?? 60_000, windowsHide: true },
      );
    } catch (error) {
      throw new NarrationJoinError(
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? "ffmpeg is not available, so the narration's pauses could not be inserted."
          : "The narration's spoken parts could not be joined with their pauses.",
      );
    }
    const bytes = await readFile(outputPath);
    if (bytes.length === 0)
      throw new NarrationJoinError("Joining the narration produced no audio.");
    return bytes;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}
