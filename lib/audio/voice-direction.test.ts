import { describe, expect, it } from "vitest";
import {
  composeVoiceInstructions,
  EMPTY_VOICE_DIRECTION,
  parseEmphasisList,
  sceneVoiceDirectionSchema,
} from "@/lib/audio/voice-direction";

describe("composeVoiceInstructions", () => {
  it("adds the scene's tone, pacing and emphasis after the preset's own", () => {
    expect(
      composeVoiceInstructions({
        presetInstructions: "Warm, clear documentary narrator.",
        direction: {
          voiceTone: "Curious, tense, intriguing",
          voicePacing: "Deliberate, building suspense.",
          voiceEmphasis: ["40 hours a week", "poorer"],
        },
      }),
    ).toBe(
      'Warm, clear documentary narrator.\n\nDeliver this scene as follows.\nTone: Curious, tense, intriguing.\nPacing: Deliberate, building suspense.\nPut clear vocal emphasis on: "40 hours a week", "poorer".',
    );
  });

  it("leaves the preset's instructions untouched when the scene has no direction", () => {
    expect(
      composeVoiceInstructions({
        presetInstructions: "  Calm.  ",
        direction: EMPTY_VOICE_DIRECTION,
      }),
    ).toBe("Calm.");
  });

  it("works without preset instructions, and only includes what was given", () => {
    expect(
      composeVoiceInstructions({
        presetInstructions: "",
        direction: {
          voiceTone: "",
          voicePacing: "Staccato",
          voiceEmphasis: [],
        },
      }),
    ).toBe("Deliver this scene as follows.\nPacing: Staccato.");
  });
});

describe("raised phrases", () => {
  it("are asked of the voice by name, even when the scene has no other direction", () => {
    const instructions = composeVoiceInstructions({
      presetInstructions: "",
      direction: EMPTY_VOICE_DIRECTION,
      raisedPhrases: ["confidence", "NEVER cut spending"],
    });
    expect(instructions).toContain(
      'Raise your voice on "confidence", "NEVER cut spending": noticeably louder',
    );
    expect(instructions).toContain(
      "Return to your normal level straight after.",
    );
  });
});

describe("parseEmphasisList", () => {
  it("splits a written list, drops quotes, blanks and repeats", () => {
    expect(
      parseEmphasisList('40 hours a week, "poorer",, missing piece; poorer'),
    ).toEqual(["40 hours a week", "poorer", "missing piece"]);
  });
});

describe("sceneVoiceDirectionSchema", () => {
  it("defaults to no direction, so older scenes parse unchanged", () => {
    expect(sceneVoiceDirectionSchema.parse({})).toEqual(EMPTY_VOICE_DIRECTION);
  });
});
