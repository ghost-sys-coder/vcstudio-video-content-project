import { describe, expect, it } from "vitest";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";

describe("script statistics", () => {
  it("calculates characters, words, and 150 WPM duration", () => {
    expect(calculateScriptStatistics("one two three")).toEqual({
      characterCount: 13,
      wordCount: 3,
      estimatedNarrationDurationSeconds: 2,
    });
  });
});
