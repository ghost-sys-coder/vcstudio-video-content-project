import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseFfprobeDurationMilliseconds } from "@/lib/media/ffprobe-output";

const execFileAsync = promisify(execFile);

export class FfprobeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FfprobeUnavailableError";
  }
}

function isMissingBinaryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (Reflect.get(error, "code") === "ENOENT" ||
      Reflect.get(error, "code") === "EACCES")
  );
}

/**
 * Inspects encoded audio bytes with ffprobe and returns the duration in whole
 * milliseconds, or null when ffprobe produced no usable duration. Throws
 * FfprobeUnavailableError only when the binary itself is missing, so callers can
 * keep already-generated (paid) audio instead of discarding it. ffprobe is
 * always invoked with an argument array — never a shell string.
 */
export async function probeAudioDurationMilliseconds(input: {
  bytes: Buffer;
  ffprobePath: string;
  extension: string;
  timeoutMilliseconds?: number;
}): Promise<number | null> {
  const directory = await mkdtemp(join(tmpdir(), "vcstudio-audio-"));
  const safeExtension = input.extension.replace(/[^a-z0-9]/gi, "") || "bin";
  const filePath = join(directory, `probe.${safeExtension}`);
  try {
    await writeFile(filePath, input.bytes);
    const { stdout } = await execFileAsync(
      input.ffprobePath,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      {
        timeout: input.timeoutMilliseconds ?? 30_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return (
      parseFfprobeDurationMilliseconds(stdout)?.durationMilliseconds ?? null
    );
  } catch (error) {
    if (isMissingBinaryError(error))
      throw new FfprobeUnavailableError(
        "The ffprobe binary is not available in this environment.",
      );
    // A non-zero ffprobe exit (unreadable audio) yields no duration rather than
    // discarding the generated asset.
    return null;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
