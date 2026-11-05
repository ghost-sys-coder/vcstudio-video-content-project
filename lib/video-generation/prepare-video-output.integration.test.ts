import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import sharp from "sharp";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { prepareVideoOutput } from "./prepare-video-output";
const execute = promisify(execFile);
const bundled = resolve("node_modules/@remotion/compositor-win32-x64-msvc");
const ffmpeg =
  process.platform === "win32"
    ? join(bundled, "ffmpeg.exe")
    : (process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg");
const ffprobe =
  process.platform === "win32"
    ? join(bundled, "ffprobe.exe")
    : (process.env.FFPROBE_PATH ?? "/usr/bin/ffprobe");
const available = existsSync(ffmpeg) && existsSync(ffprobe);
describe.skipIf(!available)(
  "actual provider-free video inspection and audio policy",
  () => {
    let directory: string, bytes: Buffer;
    beforeAll(async () => {
      vi.stubEnv("FFMPEG_PATH", ffmpeg);
      vi.stubEnv("FFPROBE_PATH", ffprobe);
      directory = await mkdtemp(join(tmpdir(), "vcstudio-video-test-"));
      const file = join(directory, "source.mp4");
      const still = join(directory, "frame.png");
      await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#008000" },
      })
        .png()
        .toFile(still);
      await execute(
        ffmpeg,
        [
          "-nostdin",
          "-y",
          "-loop",
          "1",
          "-framerate",
          "24",
          "-i",
          still,
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:sample_rate=44100",
          "-t",
          "1",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-threads",
          "1",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-shortest",
          file,
        ],
        { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      bytes = await readFile(file);
    }, 30000);
    afterAll(async () => {
      vi.unstubAllEnvs();
      if (directory) await rm(directory, { recursive: true, force: true });
    });
    it("strips native sound for narrated projects and inspects actual video bytes", async () => {
      const output = await prepareVideoOutput({
        bytes,
        mute: true,
        maximumDurationSeconds: 2,
        width: 640,
        height: 360,
      });
      expect(output.metadata).toMatchObject({
        kind: "video",
        codec: "h264",
        displayWidth: 640,
        displayHeight: 360,
        hasAudio: false,
      });
      expect(output.metadata.durationMilliseconds).toBeGreaterThanOrEqual(900);
      expect(output.bytes).not.toEqual(bytes);
    });
    it("preserves sound and bytes for independent native-audio generation", async () => {
      const output = await prepareVideoOutput({
        bytes,
        mute: false,
        maximumDurationSeconds: 2,
        width: 640,
        height: 360,
      });
      expect(output.metadata.hasAudio).toBe(true);
      expect(output.bytes).toEqual(bytes);
    });
    it("rejects malformed files, wrong geometry and excess duration before reuse", async () => {
      await expect(
        prepareVideoOutput({
          bytes: Buffer.from("disguised video"),
          mute: false,
          maximumDurationSeconds: 2,
          width: 640,
          height: 360,
        }),
      ).rejects.toThrow();
      await expect(
        prepareVideoOutput({
          bytes,
          mute: false,
          maximumDurationSeconds: 2,
          width: 360,
          height: 640,
        }),
      ).rejects.toThrow("inspection");
      await expect(
        prepareVideoOutput({
          bytes,
          mute: false,
          maximumDurationSeconds: 0.1,
          width: 640,
          height: 360,
        }),
      ).rejects.toThrow("inspection");
    });
  },
);
