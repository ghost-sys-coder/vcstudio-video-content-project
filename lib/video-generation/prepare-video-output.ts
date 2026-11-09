import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { inspectMediaFile } from "@/lib/media/inspect-media-file";
import { sceneAudioEnvironmentSchema } from "@/lib/env/server-schema";
import { MAX_VIDEO_BYTES } from "./providers/provider-http";
const execute = promisify(execFile);
export async function prepareVideoOutput(input: {
  bytes: Buffer;
  mute: boolean;
  maximumDurationSeconds: number;
  width: number;
  height: number;
}) {
  const environment = sceneAudioEnvironmentSchema
    .pick({ FFPROBE_PATH: true, FFMPEG_PATH: true })
    .parse(process.env);
  let bytes = input.bytes;
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES)
    throw new Error("Video output exceeds the supported size.");
  if (input.mute) {
    const directory = await mkdtemp(join(tmpdir(), "vcstudio-video-"));
    try {
      const source = join(directory, "source.mp4"),
        output = join(directory, "output.mp4");
      await writeFile(source, bytes);
      await execute(
        environment.FFMPEG_PATH,
        [
          "-nostdin",
          "-y",
          "-i",
          source,
          "-map",
          "0:v:0",
          "-c:v",
          "copy",
          "-an",
          "-movflags",
          "+faststart",
          output,
        ],
        { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      bytes = await readFile(output);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  const result = await inspectMediaFile({
    bytes,
    extension: "mp4",
    expectedKind: "video",
    ffprobePath: environment.FFPROBE_PATH,
    ffmpegPath: environment.FFMPEG_PATH,
    createThumbnail: true,
  });
  const metadata = result.metadata;
  if (
    metadata.kind !== "video" ||
    metadata.durationMilliseconds > input.maximumDurationSeconds * 1000 + 500 ||
    metadata.durationMilliseconds < 500 ||
    Math.abs(
      metadata.displayWidth / metadata.displayHeight -
        input.width / input.height,
    ) > 0.03 ||
    !["h264", "hevc", "vp9", "av1"].includes(metadata.codec) ||
    (input.mute && metadata.hasAudio)
  )
    throw new Error(
      "The generated video failed duration, shape or codec inspection.",
    );
  return {
    bytes,
    metadata,
    thumbnail: result.thumbnail,
    warnings: result.warnings.filter(
      (warning) => !(input.mute && warning === "The video has no audio track."),
    ),
  };
}
