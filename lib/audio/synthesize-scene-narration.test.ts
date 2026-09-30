import { describe, expect, it, vi } from "vitest";
import { parseNarrationParts } from "@/lib/audio/narration-directives";
import {
  NarrationSegmentFailure,
  synthesizeSceneNarration,
  type SpokenClip,
} from "@/lib/audio/synthesize-scene-narration";

function clip(text: string, format: string): SpokenClip {
  return {
    bytes: Buffer.from(`${format}:${text}`),
    contentType: `audio/${format}`,
    format: format as SpokenClip["format"],
    requestId: `req-${text}`,
    characterCount: text.length,
  };
}

describe("synthesizeSceneNarration", () => {
  it("makes one request in the preset's format when there are no pauses", async () => {
    const speak = vi.fn(async (text: string, format: string) =>
      clip(text, format),
    );
    const join = vi.fn();
    const result = await synthesizeSceneNarration({
      parts: parseNarrationParts("Just one line."),
      format: "mp3",
      speak,
      join,
      contentTypeFor: () => "audio/mpeg",
    });
    expect(speak).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledWith("Just one line.", "mp3");
    expect(join).not.toHaveBeenCalled();
    expect(result.bytes.toString()).toBe("mp3:Just one line.");
  });

  it("voices each part as WAV and joins them with the written silences", async () => {
    const speak = vi.fn(async (text: string, format: string) =>
      clip(text, format),
    );
    const join = vi.fn(async () => Buffer.from("joined"));
    const result = await synthesizeSceneNarration({
      parts: parseNarrationParts("On time. [PAUSE: 0.5s] Yet poorer."),
      format: "mp3",
      speak,
      join,
      contentTypeFor: () => "audio/mpeg",
    });
    expect(speak.mock.calls).toEqual([
      ["On time.", "wav"],
      ["Yet poorer.", "wav"],
    ]);
    expect(join).toHaveBeenCalledWith(
      [
        { kind: "clip", bytes: Buffer.from("wav:On time.") },
        { kind: "silence", milliseconds: 500 },
        { kind: "clip", bytes: Buffer.from("wav:Yet poorer.") },
      ],
      "mp3",
    );
    expect(result).toMatchObject({
      contentType: "audio/mpeg",
      format: "mp3",
      requestId: "req-On time.",
      characterCount: "On time.".length + "Yet poorer.".length,
    });
  });

  it("reports that earlier segments were paid for when a later one fails", async () => {
    const failure = new Error("provider down");
    const speak = vi.fn(async (text: string, format: string) => {
      if (text === "Yet poorer.") throw failure;
      return clip(text, format);
    });
    const attempt = synthesizeSceneNarration({
      parts: parseNarrationParts("On time. [PAUSE: 0.5s] Yet poorer."),
      format: "mp3",
      speak,
      join: vi.fn(),
      contentTypeFor: () => "audio/mpeg",
    });
    await expect(attempt).rejects.toBeInstanceOf(NarrationSegmentFailure);
    await expect(attempt).rejects.toMatchObject({
      completedSegments: 1,
      cause: failure,
    });
  });

  it("passes a first-segment failure through unchanged", async () => {
    const failure = new Error("provider down");
    await expect(
      synthesizeSceneNarration({
        parts: parseNarrationParts("A [PAUSE] B"),
        format: "mp3",
        speak: async () => {
          throw failure;
        },
        join: vi.fn(),
        contentTypeFor: () => "audio/mpeg",
      }),
    ).rejects.toBe(failure);
  });

  it("keeps a raised span inside its sentence unless a boost is asked for", async () => {
    const parts = parseNarrationParts("It runs on [RAISE]confidence[/RAISE].");
    const speak = vi.fn(async (text: string, format: string) =>
      clip(text, format),
    );
    await synthesizeSceneNarration({
      parts,
      format: "mp3",
      speak,
      join: vi.fn(),
      contentTypeFor: () => "audio/mpeg",
    });
    expect(speak.mock.calls).toEqual([["It runs on confidence.", "mp3"]]);

    const boosted = vi.fn(async (text: string, format: string) =>
      clip(text, format),
    );
    const join = vi.fn(async () => Buffer.from("joined"));
    await synthesizeSceneNarration({
      parts,
      format: "mp3",
      speak: boosted,
      join,
      contentTypeFor: () => "audio/mpeg",
      raisedGainDb: 4,
    });
    // The full stop rides with the raised word rather than being voiced alone.
    expect(boosted.mock.calls.map(([text]) => text)).toEqual([
      "It runs on",
      "confidence.",
    ]);
    expect(join).toHaveBeenCalledWith(
      [
        { kind: "clip", bytes: Buffer.from("wav:It runs on") },
        { kind: "clip", bytes: Buffer.from("wav:confidence."), gainDb: 4 },
      ],
      "mp3",
    );
  });
});
