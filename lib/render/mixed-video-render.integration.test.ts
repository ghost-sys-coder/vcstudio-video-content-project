import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { createServer, type Server } from "node:http";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { RemotionVideoRenderProvider } from "./remotion-video-render-provider";
import { parseVideoCompositionInput } from "./render-composition-input";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
const execute = promisify(execFile);
const ffmpeg = resolve(
  "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe",
);
describe.skipIf(
  process.env.VCSTUDIO_VERIFY_LOCAL_RENDER !== "true" ||
    !existsSync(ffmpeg) ||
    !existsSync(chromium.executablePath()),
)("actual mixed-media Remotion export", () => {
  it("decodes a still and contained muted video with independent narration", async () => {
    const folder = await mkdtemp(join(tmpdir(), "vcstudio-mixed-render-"));
    let server: Server | undefined;
    try {
      await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#008000" },
      })
        .png()
        .toFile(join(folder, "still.png"));
      await sharp({
        create: { width: 200, height: 300, channels: 3, background: "#ff0000" },
      })
        .png()
        .toFile(join(folder, "portrait.png"));
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
          join(folder, "portrait.png"),
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=880:sample_rate=44100",
          "-t",
          "0.5",
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
          join(folder, "clip.mp4"),
        ],
        { windowsHide: true, timeout: 30000 },
      );
      await execute(
        ffmpeg,
        [
          "-nostdin",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=220:sample_rate=44100",
          "-t",
          "1",
          join(folder, "narration.wav"),
        ],
        { windowsHide: true, timeout: 30000 },
      );
      server = createServer(async (request, response) => {
        const name = request.url?.slice(1);
        if (
          !name ||
          !["still.png", "clip.mp4", "narration.wav"].includes(name)
        ) {
          response.writeHead(404).end();
          return;
        }
        const bytes = await readFile(join(folder, name));
        response.writeHead(200, {
          "Content-Type": name.endsWith("mp4")
            ? "video/mp4"
            : name.endsWith("wav")
              ? "audio/wav"
              : "image/png",
          "Content-Length": bytes.length,
          "Access-Control-Allow-Origin": "*",
        });
        response.end(bytes);
      });
      await new Promise<void>((resolve) =>
        server!.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No fixture port");
      const base = `http://127.0.0.1:${address.port}`;
      const scene = {
        sceneId: "11111111-1111-4111-8111-111111111111",
        sceneNumber: 1,
        startFrame: 0,
        durationFrames: 24,
        cameraMotion: "none",
        transition: "cut",
        imageUrl: `${base}/still.png`,
        audioUrl: `${base}/narration.wav`,
        captions: [],
      };
      const input = parseVideoCompositionInput({
        mediaVersion: 2,
        width: 640,
        height: 360,
        framesPerSecond: 24,
        durationInFrames: 48,
        includeCaptions: false,
        includeWatermark: false,
        watermarkText: "",
        captionStyle: DEFAULT_CAPTION_STYLE,
        scenes: [
          scene,
          {
            ...scene,
            sceneId: "22222222-2222-4222-8222-222222222222",
            sceneNumber: 2,
            startFrame: 24,
            imageUrl: null,
            video: {
              url: `${base}/clip.mp4`,
              trimBeforeFrames: 0,
              durationFrames: 12,
              loop: true,
              fit: "contain",
            },
          },
        ],
      });
      const output = join(folder, "mixed.mp4");
      await new RemotionVideoRenderProvider().render({
        entryPointPath: resolve("remotion/index.ts"),
        aliasRoot: resolve("."),
        compositionId: "StudioVideo",
        input,
        outputFilePath: output,
        crf: 23,
        jpegQuality: 80,
        concurrency: 1,
        timeoutMilliseconds: 60000,
        chromiumExecutable: chromium.executablePath(),
      });
      for (const [time, name] of [
        ["0.5", "still-result.png"],
        ["1.75", "video-result.png"],
      ])
        await execute(
          ffmpeg,
          [
            "-nostdin",
            "-y",
            "-ss",
            time!,
            "-i",
            output,
            "-frames:v",
            "1",
            join(folder, name!),
          ],
          { windowsHide: true, timeout: 30000 },
        );
      await writeFile(
        resolve(".vercel/mixed-render-still.png"),
        await readFile(join(folder, "still-result.png")),
      );
      await writeFile(
        resolve(".vercel/mixed-render-video.png"),
        await readFile(join(folder, "video-result.png")),
      );
      const still = await sharp(
        await sharp(join(folder, "still-result.png"))
          .extract({ left: 300, top: 160, width: 20, height: 20 })
          .png()
          .toBuffer(),
      ).stats();
      expect(still.channels[1]!.mean).toBeGreaterThan(110);
      expect(still.channels[0]!.mean).toBeLessThan(20);
      const center = await sharp(
        await sharp(join(folder, "video-result.png"))
          .extract({ left: 300, top: 160, width: 20, height: 20 })
          .png()
          .toBuffer(),
      ).stats();
      expect(center.channels[0]!.mean).toBeGreaterThan(230);
      expect(center.channels[1]!.mean).toBeLessThan(20);
      const edge = await sharp(
        await sharp(join(folder, "video-result.png"))
          .extract({ left: 10, top: 160, width: 20, height: 20 })
          .png()
          .toBuffer(),
      ).stats();
      expect(edge.channels.every((channel) => channel.mean < 10)).toBe(true);
      const pcm = join(folder, "audio.wav");
      await execute(
        ffmpeg,
        [
          "-nostdin",
          "-y",
          "-ss",
          "1.1",
          "-t",
          "0.6",
          "-i",
          output,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "44100",
          "-c:a",
          "pcm_s16le",
          pcm,
        ],
        { windowsHide: true, timeout: 30000 },
      );
      const wave = await readFile(pcm);
      let dataOffset = 12;
      while (
        dataOffset + 8 < wave.length &&
        wave.toString("ascii", dataOffset, dataOffset + 4) !== "data"
      )
        dataOffset +=
          8 +
          wave.readUInt32LE(dataOffset + 4) +
          (wave.readUInt32LE(dataOffset + 4) % 2);
      expect(wave.toString("ascii", dataOffset, dataOffset + 4)).toBe("data");
      const samples = wave.subarray(
        dataOffset + 8,
        dataOffset + 8 + wave.readUInt32LE(dataOffset + 4),
      );
      let crossings = 0;
      for (let i = 2; i < samples.length; i += 2)
        if (samples.readInt16LE(i - 2) <= 0 && samples.readInt16LE(i) > 0)
          crossings++;
      const frequency = crossings / (samples.length / 2 / 44100);
      expect(frequency).toBeGreaterThan(210);
      expect(frequency).toBeLessThan(230);
      await writeFile(
        resolve(".vercel/video-local-render-verification.json"),
        JSON.stringify({
          mixedRender: true,
          containBars: true,
          loop: true,
          narrationFrequency: frequency,
          nativeAudioMuted: true,
        }),
      );
    } finally {
      await new Promise<void>((resolve) =>
        server ? server.close(() => resolve()) : resolve(),
      );
      await rm(folder, { recursive: true, force: true });
    }
  }, 180000);
});
