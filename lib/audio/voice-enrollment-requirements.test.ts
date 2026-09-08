import { describe, expect, it } from "vitest";
import {
  CONSENT_RECORDING_SPEC,
  SAMPLE_RECORDING_SPEC,
  evaluateVoiceRecording,
  isVoiceRecordingAcceptable,
  voiceRecordingFileName,
  type VoiceRecordingCapture,
} from "@/lib/audio/voice-enrollment-requirements";

function capture(
  overrides: Partial<VoiceRecordingCapture> = {},
): VoiceRecordingCapture {
  return {
    sizeBytes: 400_000,
    mimeType: "audio/webm",
    durationMilliseconds: 45_000,
    peakLevel: 0.6,
    averageLevel: 0.08,
    ...overrides,
  };
}

function statusOf(
  results: ReturnType<typeof evaluateVoiceRecording>,
  id: string,
) {
  return results.find((result) => result.id === id)?.status;
}

describe("evaluateVoiceRecording", () => {
  it("marks every requirement as waiting before anything is recorded", () => {
    const results = evaluateVoiceRecording(CONSENT_RECORDING_SPEC, null);
    expect(results.every((result) => result.status === "waiting")).toBe(true);
    expect(isVoiceRecordingAcceptable(results)).toBe(false);
  });

  it("accepts a clean sample recording", () => {
    const results = evaluateVoiceRecording(SAMPLE_RECORDING_SPEC, capture());
    expect(statusOf(results, "captured")).toBe("met");
    expect(statusOf(results, "duration")).toBe("met");
    expect(statusOf(results, "audible")).toBe("met");
    expect(isVoiceRecordingAcceptable(results)).toBe(true);
  });

  it("rejects a sample shorter than the required minimum", () => {
    const results = evaluateVoiceRecording(
      SAMPLE_RECORDING_SPEC,
      capture({ durationMilliseconds: 12_000 }),
    );
    expect(statusOf(results, "duration")).toBe("unmet");
    expect(isVoiceRecordingAcceptable(results)).toBe(false);
  });

  it("accepts the same 12 second clip as a consent statement", () => {
    const results = evaluateVoiceRecording(
      CONSENT_RECORDING_SPEC,
      capture({ durationMilliseconds: 12_000 }),
    );
    expect(isVoiceRecordingAcceptable(results)).toBe(true);
  });

  it("rejects a silent recording rather than reporting it as captured", () => {
    const results = evaluateVoiceRecording(
      SAMPLE_RECORDING_SPEC,
      capture({ peakLevel: 0.001, averageLevel: 0 }),
    );
    expect(statusOf(results, "captured")).toBe("met");
    expect(statusOf(results, "audible")).toBe("unmet");
    expect(isVoiceRecordingAcceptable(results)).toBe(false);
  });

  it("warns without blocking on a quiet but audible recording", () => {
    const results = evaluateVoiceRecording(
      SAMPLE_RECORDING_SPEC,
      capture({ peakLevel: 0.2, averageLevel: 0.002 }),
    );
    expect(statusOf(results, "audible")).toBe("warning");
    expect(isVoiceRecordingAcceptable(results)).toBe(true);
  });

  it("rejects an unsupported container and an oversized recording", () => {
    expect(
      statusOf(
        evaluateVoiceRecording(
          SAMPLE_RECORDING_SPEC,
          capture({ mimeType: "video/x-matroska" }),
        ),
        "format",
      ),
    ).toBe("unmet");
    expect(
      statusOf(
        evaluateVoiceRecording(
          SAMPLE_RECORDING_SPEC,
          capture({ sizeBytes: 11 * 1024 * 1024 }),
        ),
        "size",
      ),
    ).toBe("unmet");
  });

  it("ignores codec parameters when checking the format", () => {
    const results = evaluateVoiceRecording(
      SAMPLE_RECORDING_SPEC,
      capture({ mimeType: "audio/webm;codecs=opus" }),
    );
    expect(statusOf(results, "format")).toBe("met");
  });
});

describe("voiceRecordingFileName", () => {
  it("derives the extension from the recorded container", () => {
    expect(
      voiceRecordingFileName(CONSENT_RECORDING_SPEC, "audio/webm;codecs=opus"),
    ).toBe("consent.webm");
    expect(voiceRecordingFileName(SAMPLE_RECORDING_SPEC, "audio/mp4")).toBe(
      "sample.m4a",
    );
  });
});
