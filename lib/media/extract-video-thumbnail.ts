import "server-only";

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execute = promisify(execFile);

/** One frame from the inspector's existing local file; never a URL or shell command. */
export async function extractVideoThumbnail(input: {
  source: string;
  directory: string;
  ffmpegPath: string;
  durationMilliseconds: number;
}) {
  const timestampMilliseconds = Math.min(
    1000,
    Math.floor(input.durationMilliseconds / 4),
  );
  const output = join(input.directory, "poster.jpg");
  await execute(
    input.ffmpegPath,
    [
      "-nostdin",
      "-v",
      "error",
      "-y",
      "-protocol_whitelist",
      "file,pipe",
      "-threads",
      "1",
      "-ss",
      String(timestampMilliseconds / 1000),
      "-i",
      input.source,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-an",
      "-vf",
      "scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-threads",
      "1",
      "-q:v",
      "4",
      "-update",
      "1",
      output,
    ],
    { timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true },
  );
  const bytes = await readFile(output);
  if (!bytes.length || bytes.length > 512 * 1024)
    throw new Error("VIDEO_THUMBNAIL_SIZE_INVALID");
  const metadata = await sharp(bytes, {
    limitInputPixels: 640 * 640,
    failOn: "error",
  }).metadata();
  if (
    metadata.format !== "jpeg" ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 640 ||
    metadata.height > 640
  )
    throw new Error("VIDEO_THUMBNAIL_INVALID");
  return {
    bytes,
    width: metadata.width,
    height: metadata.height,
    timestampMilliseconds,
  };
}
