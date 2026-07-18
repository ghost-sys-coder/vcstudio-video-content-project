import { describe, expect, it } from "vitest";
import { parseFfprobeDurationMilliseconds } from "@/lib/media/ffprobe-output";

describe("parseFfprobeDurationMilliseconds", () => {
  it("parses container format duration to whole milliseconds", () => {
    const json = JSON.stringify({ format: { duration: "12.345000" } });
    expect(parseFfprobeDurationMilliseconds(json)).toEqual({
      durationMilliseconds: 12345,
    });
  });

  it("falls back to the longest stream duration when format is missing", () => {
    const json = JSON.stringify({
      streams: [{ duration: "3.2" }, { duration: "4.8" }],
    });
    expect(parseFfprobeDurationMilliseconds(json)).toEqual({
      durationMilliseconds: 4800,
    });
  });

  it("prefers the larger of format and stream durations", () => {
    const json = JSON.stringify({
      format: { duration: "5.0" },
      streams: [{ duration: "5.4" }],
    });
    expect(parseFfprobeDurationMilliseconds(json)?.durationMilliseconds).toBe(
      5400,
    );
  });

  it("returns null for malformed JSON", () => {
    expect(parseFfprobeDurationMilliseconds("not json")).toBeNull();
  });

  it("returns null when no usable duration is present", () => {
    expect(
      parseFfprobeDurationMilliseconds(
        JSON.stringify({ format: { duration: "N/A" }, streams: [] }),
      ),
    ).toBeNull();
  });

  it("ignores negative or non-numeric durations", () => {
    expect(
      parseFfprobeDurationMilliseconds(
        JSON.stringify({ format: { duration: "-2.0" } }),
      ),
    ).toBeNull();
  });
});
