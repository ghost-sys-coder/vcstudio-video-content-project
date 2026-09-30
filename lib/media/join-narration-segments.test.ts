import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  buildNarrationJoinArguments,
  joinNarrationSegments,
} from "@/lib/media/join-narration-segments";
import { encodeMonoWav } from "@/lib/audio/encode-wav";

describe("buildNarrationJoinArguments", () => {
  it("plays clips in order with exact silences between them", () => {
    const args = buildNarrationJoinArguments({
      items: [
        { kind: "clip", path: "a.wav" },
        { kind: "silence", milliseconds: 500 },
        { kind: "clip", path: "b.wav" },
      ],
      format: "mp3",
      outputPath: "out.mp3",
    });
    expect(args.filter((arg) => arg === "-i")).toHaveLength(2);
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("[0:a]aresample=24000");
    // The written half second, on top of the narrator's natural break.
    expect(filter).toContain("anullsrc=r=24000:cl=mono,atrim=duration=0.950");
    expect(filter).toContain("[1:a]aresample=24000");
    expect(filter).toContain("[a0][a1][a2]concat=n=3:v=0:a=1[out]");
    expect(args).toContain("libmp3lame");
    expect(args.at(-1)).toBe("out.mp3");
  });

  it("trims a clip's own quiet edge only where it meets a pause", () => {
    const args = buildNarrationJoinArguments({
      items: [
        { kind: "clip", path: "a.wav", trimEnd: true },
        { kind: "silence", milliseconds: 500 },
        { kind: "clip", path: "b.wav", trimStart: true },
      ],
      format: "wav",
      outputPath: "out.wav",
    });
    const filter = args[args.indexOf("-filter_complex") + 1] ?? "";
    const [first, , second] = filter.split(";");
    expect(first).toContain("areverse,silenceremove=start_periods=1");
    expect(first?.startsWith("[0:a]aresample")).toBe(true);
    expect(first?.match(/silenceremove/g)).toHaveLength(1);
    expect(second).toContain("silenceremove=start_periods=1");
    expect(second).not.toContain("areverse");
  });

  it("encodes into whatever format the preset asked for", () => {
    const codec = (format: "opus" | "wav" | "aac" | "flac" | "pcm") => {
      const args = buildNarrationJoinArguments({
        items: [{ kind: "clip", path: "a.wav" }],
        format,
        outputPath: "out",
      });
      return args[args.indexOf("-c:a") + 1];
    };
    expect(codec("opus")).toBe("libopus");
    expect(codec("wav")).toBe("pcm_s16le");
    expect(codec("aac")).toBe("aac");
    expect(codec("flac")).toBe("flac");
    expect(codec("pcm")).toBe("pcm_s16le");
  });
});

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.runIf(ffmpegAvailable())("joinNarrationSegments with ffmpeg", () => {
  it("boosts a clip without letting it clip", async () => {
    // A tone already peaking at 0.9 of full scale, boosted by 6 dB.
    const loud = Buffer.from(
      encodeMonoWav(
        Float32Array.from(
          { length: 24_000 },
          (_, index) => Math.sin(index / 10) * 0.9,
        ),
        24_000,
      ),
    );
    const bytes = await joinNarrationSegments({
      parts: [{ kind: "clip", bytes: loud, gainDb: 6 }],
      format: "wav",
      ffmpegPath: "ffmpeg",
    });
    let peak = 0;
    for (let offset = 44; offset + 1 < bytes.length; offset += 2)
      peak = Math.max(peak, Math.abs(bytes.readInt16LE(offset)));
    // At or below about -1 dBFS (0.89 of 32,768), never at full scale.
    expect(peak).toBeLessThanOrEqual(Math.ceil(0.9 * 32_768));
    expect(peak).toBeGreaterThan(0.8 * 32_768);
  }, 30_000);

  it("makes the gap the written length even when clips carry their own silence", async () => {
    // One second of tone framed by 300 ms of silence on each side, the way a
    // voice model returns a clip.
    const framed = () =>
      Buffer.from(
        encodeMonoWav(
          Float32Array.from({ length: 24_000 * 1.6 }, (_, index) =>
            index < 7_200 || index >= 31_200 ? 0 : Math.sin(index / 10) * 0.3,
          ),
          24_000,
        ),
      );
    const bytes = await joinNarrationSegments({
      parts: [
        { kind: "clip", bytes: framed() },
        { kind: "silence", milliseconds: 500 },
        { kind: "clip", bytes: framed() },
      ],
      format: "wav",
      ffmpegPath: "ffmpeg",
    });
    // The clips' own 0.3 s edges at the pause are replaced by a consistent
    // break: 1.3 + ~0.03 + (0.45 + 0.5) + ~0.03 + 1.3 ≈ 3.61 s.
    const seconds = (bytes.length - 44) / 48_000;
    expect(seconds).toBeGreaterThan(3.55);
    expect(seconds).toBeLessThan(3.7);
  }, 30_000);

  it("produces a file as long as the clips plus the silence", async () => {
    const tone = (seconds: number) =>
      Buffer.from(
        encodeMonoWav(
          Float32Array.from(
            { length: 24_000 * seconds },
            (_, index) => Math.sin(index / 10) * 0.3,
          ),
          24_000,
        ),
      );
    const bytes = await joinNarrationSegments({
      parts: [
        { kind: "clip", bytes: tone(1) },
        { kind: "silence", milliseconds: 500 },
        { kind: "clip", bytes: tone(1) },
      ],
      format: "wav",
      ffmpegPath: "ffmpeg",
    });
    // 16-bit mono at 24 kHz: 48,000 bytes a second, after a 44-byte-ish header.
    // 1 s + (0.45 s natural break + 0.5 s written) + 1 s.
    const seconds = (bytes.length - 44) / 48_000;
    expect(seconds).toBeGreaterThan(2.9);
    expect(seconds).toBeLessThan(3.05);
  }, 30_000);
});
