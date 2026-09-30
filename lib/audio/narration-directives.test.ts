import { describe, expect, it } from "vitest";
import {
  extractRaisedPhrases,
  hasNarrationPauses,
  isNarrationDeliveryMarker,
  isPauseMarker,
  parseNarrationParts,
  stripNarrationDirectives,
} from "@/lib/audio/narration-directives";

describe("parseNarrationParts", () => {
  it("splits speech at each pause, with the written length", () => {
    expect(
      parseNarrationParts(
        "You work 40 hours a week. [PAUSE: 0.5s] Yet every year, you feel poorer. [PAUSE: 1.2s] Why?",
      ),
    ).toEqual([
      { kind: "speech", text: "You work 40 hours a week." },
      { kind: "pause", milliseconds: 500 },
      { kind: "speech", text: "Yet every year, you feel poorer." },
      { kind: "pause", milliseconds: 1200 },
      { kind: "speech", text: "Why?" },
    ]);
  });

  it("reads the forms people write, and defaults a bare pause to half a second", () => {
    const pauses = (text: string) =>
      parseNarrationParts(`A ${text} B`).find((part) => part.kind === "pause");
    expect(pauses("[PAUSE]")).toEqual({ kind: "pause", milliseconds: 500 });
    expect(pauses("[pause 800ms]")).toEqual({
      kind: "pause",
      milliseconds: 800,
    });
    expect(pauses("[BREAK: 1 sec]")).toEqual({
      kind: "pause",
      milliseconds: 1000,
    });
    expect(pauses("[PAUSE: 2 seconds]")).toEqual({
      kind: "pause",
      milliseconds: 2000,
    });
  });

  it("keeps pauses within sane bounds and merges adjacent ones", () => {
    expect(parseNarrationParts("A [PAUSE: 10s] B")[1]).toEqual({
      kind: "pause",
      milliseconds: 10000,
    });
    expect(parseNarrationParts("A [PAUSE: 30s] B")[1]).toEqual({
      kind: "pause",
      milliseconds: 10000,
    });
    expect(parseNarrationParts("A [PAUSE: 0.01s] B")[1]).toEqual({
      kind: "pause",
      milliseconds: 100,
    });
    expect(parseNarrationParts("A [PAUSE: 0.5s] [PAUSE: 0.5s] B")).toEqual([
      { kind: "speech", text: "A" },
      { kind: "pause", milliseconds: 1000 },
      { kind: "speech", text: "B" },
    ]);
  });

  it("leaves narration without markers as one spoken part", () => {
    expect(parseNarrationParts("  Just   words.  ")).toEqual([
      { kind: "speech", text: "Just words." },
    ]);
  });

  it("does not mistake a bracketed aside for timing", () => {
    expect(parseNarrationParts("Wait [pause for thought] here")).toEqual([
      { kind: "speech", text: "Wait [pause for thought] here" },
    ]);
    expect(isPauseMarker("pause for thought")).toBe(false);
    expect(isPauseMarker("PAUSE: 0.5s")).toBe(true);
  });
});

describe("stripNarrationDirectives", () => {
  it("returns only the words a listener hears", () => {
    expect(stripNarrationDirectives("time. [PAUSE: 0.5s] Yet every year")).toBe(
      "time. Yet every year",
    );
    expect(hasNarrationPauses("time. [PAUSE: 0.5s] Yet")).toBe(true);
    expect(hasNarrationPauses("time. Yet")).toBe(false);
  });
});

describe("raised-voice spans", () => {
  it("keep the sentence whole and record which words are raised", () => {
    expect(
      parseNarrationParts(
        "It doesn't run on money... it runs on [RAISE]confidence[/RAISE]. [PAUSE: 0.5s] When confidence breaks.",
      ),
    ).toEqual([
      {
        kind: "speech",
        text: "It doesn't run on money... it runs on confidence.",
        spans: [
          { text: "It doesn't run on money... it runs on", raised: false },
          { text: "confidence", raised: true },
          { text: ".", raised: false },
        ],
      },
      { kind: "pause", milliseconds: 500 },
      { kind: "speech", text: "When confidence breaks." },
    ]);
  });

  it("names each raised phrase once, and an unclosed span runs to the end", () => {
    expect(
      extractRaisedPhrases(
        "Pull it [RAISE]UP[/RAISE]. [PAUSE] Then [RAISE]up[/RAISE] again, [raise]instantly",
      ),
    ).toEqual(["UP", "up", "instantly"]);
  });

  it("never shows raise markers in the spoken text", () => {
    expect(
      stripNarrationDirectives("on [RAISE]confidence[/RAISE]. [PAUSE] Next"),
    ).toBe("on confidence. Next");
    expect(isNarrationDeliveryMarker("RAISE")).toBe(true);
    expect(isNarrationDeliveryMarker("/RAISE")).toBe(true);
    expect(isNarrationDeliveryMarker("PAUSE: 1s")).toBe(true);
    expect(isNarrationDeliveryMarker("VISUAL")).toBe(false);
  });
});
