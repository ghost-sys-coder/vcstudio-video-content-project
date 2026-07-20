import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_VOICE_ID,
  VOICE_OPTIONS,
  VOICE_PREVIEW_IDS,
  VOICE_PREVIEW_SAMPLE_TEXT,
  isPreviewVoice,
  voicePreviewVoiceSchema,
} from "@/lib/audio/voice-catalog";

describe("voice catalog", () => {
  it("exposes a non-empty fixed sample line", () => {
    expect(VOICE_PREVIEW_SAMPLE_TEXT.trim().length).toBeGreaterThan(0);
  });

  it("has unique, non-empty voice ids and labels", () => {
    expect(VOICE_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(VOICE_PREVIEW_IDS).size).toBe(VOICE_OPTIONS.length);
    for (const option of VOICE_OPTIONS) {
      expect(option.id.trim().length).toBeGreaterThan(0);
      expect(option.label.trim().length).toBeGreaterThan(0);
      expect(option.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("defaults to a catalogued voice", () => {
    expect(VOICE_PREVIEW_IDS).toContain(DEFAULT_PREVIEW_VOICE_ID);
  });

  it("only accepts catalogued voices", () => {
    for (const id of VOICE_PREVIEW_IDS) {
      expect(isPreviewVoice(id)).toBe(true);
      expect(voicePreviewVoiceSchema.safeParse(id).success).toBe(true);
    }
    expect(isPreviewVoice("not-a-voice")).toBe(false);
    expect(voicePreviewVoiceSchema.safeParse("not-a-voice").success).toBe(
      false,
    );
    expect(voicePreviewVoiceSchema.safeParse("").success).toBe(false);
  });
});
