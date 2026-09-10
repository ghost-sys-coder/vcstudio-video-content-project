import { describe, expect, it } from "vitest";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import { STRUCTURED_SCRIPT_FIXTURE } from "@/lib/test-utils/structured-script-fixture";

describe("script statistics", () => {
  it("calculates characters, words, and 150 WPM duration", () => {
    expect(calculateScriptStatistics("one two three")).toEqual({
      characterCount: 13,
      wordCount: 3,
      narrationWordCount: 3,
      estimatedNarrationDurationSeconds: 2,
    });
  });

  it("counts an ordinary script's every word as spoken", () => {
    const stats = calculateScriptStatistics(
      "A plain script with no direction.",
    );
    expect(stats.narrationWordCount).toBe(stats.wordCount);
  });

  it("does not count production direction towards the runtime", () => {
    // The estimate follows what is read aloud. Counting the [VISUAL] and
    // [TEXT OVERLAY] blocks would overstate the runtime of exactly the scripts
    // most likely to carry them.
    const stats = calculateScriptStatistics(STRUCTURED_SCRIPT_FIXTURE);
    expect(stats.narrationWordCount).toBeLessThan(stats.wordCount);
    expect(stats.estimatedNarrationDurationSeconds).toBe(
      Math.ceil((stats.narrationWordCount / 150) * 60),
    );
    // The document totals still describe the document itself.
    expect(stats.characterCount).toBe(STRUCTURED_SCRIPT_FIXTURE.length);
  });

  it("treats an empty script as zero throughout", () => {
    expect(calculateScriptStatistics("")).toEqual({
      characterCount: 0,
      wordCount: 0,
      narrationWordCount: 0,
      estimatedNarrationDurationSeconds: 0,
    });
  });
});
