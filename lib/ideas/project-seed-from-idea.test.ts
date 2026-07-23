import { describe, expect, it } from "vitest";
import {
  suggestAspectRatioForPlatform,
  suggestProjectNameFromTopic,
} from "@/lib/ideas/project-seed-from-idea";

describe("suggestProjectNameFromTopic", () => {
  it("returns a short topic unchanged", () => {
    expect(suggestProjectNameFromTopic("  Why budgets fail  ")).toBe(
      "Why budgets fail",
    );
  });

  it("returns an empty string for a blank topic", () => {
    expect(suggestProjectNameFromTopic("   ")).toBe("");
  });

  it("truncates a long topic at a word boundary within the 100-char limit", () => {
    const topic =
      "Why most people fail at saving money and the one surprisingly simple habit that actually fixes it for good, according to research";
    const suggestion = suggestProjectNameFromTopic(topic);
    expect(suggestion.length).toBeLessThanOrEqual(100);
    expect(suggestion.endsWith("…")).toBe(true);
    expect(suggestion.endsWith(" …")).toBe(false);
  });
});

describe("suggestAspectRatioForPlatform", () => {
  it("suggests vertical for tiktok and instagram", () => {
    expect(suggestAspectRatioForPlatform("tiktok")).toBe("9:16");
    expect(suggestAspectRatioForPlatform("instagram")).toBe("9:16");
  });

  it("suggests landscape for youtube and facebook", () => {
    expect(suggestAspectRatioForPlatform("youtube")).toBe("16:9");
    expect(suggestAspectRatioForPlatform("facebook")).toBe("16:9");
  });
});
