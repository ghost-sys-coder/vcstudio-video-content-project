import { describe, expect, it } from "vitest";
import {
  buildHeadlineOptions,
  condenseToHeadline,
  MAX_HEADLINE_OPTIONS,
} from "@/lib/thumbnails/headline-options";
import { MAX_THUMBNAIL_HEADLINE_LENGTH } from "@/lib/schemas/thumbnail";

describe("condenseToHeadline", () => {
  it("keeps a short title unchanged", () => {
    expect(condenseToHeadline("Bridges Are Failing")).toBe(
      "Bridges Are Failing",
    );
  });

  it("prefers the hook after a colon", () => {
    expect(
      condenseToHeadline("Structural Engineering: The Signs Everyone Missed"),
    ).toBe("The Signs Everyone Missed");
  });

  it("strips bracketed and parenthetical asides", () => {
    expect(condenseToHeadline("Bridges Are Failing [2026 Update]")).toBe(
      "Bridges Are Failing",
    );
    expect(condenseToHeadline("Bridges Are Failing (Explained)")).toBe(
      "Bridges Are Failing",
    );
  });

  it("strips wrapping quotes and trailing punctuation", () => {
    expect(condenseToHeadline('"Bridges Are Failing."')).toBe(
      "Bridges Are Failing",
    );
  });

  it("keeps question and exclamation marks, which carry the hook", () => {
    expect(condenseToHeadline("Why Did It Collapse?")).toBe(
      "Why Did It Collapse?",
    );
  });

  it("truncates on a word boundary without an ellipsis", () => {
    const result = condenseToHeadline(
      "An Extremely Long Title About Structural Failure That Cannot Possibly Fit",
    );
    expect(result.length).toBeLessThanOrEqual(MAX_THUMBNAIL_HEADLINE_LENGTH);
    expect(result).not.toContain("…");
    expect(result).not.toContain("...");
    // No partial words.
    expect(
      "An Extremely Long Title About Structural Failure That Cannot Possibly Fit".startsWith(
        result,
      ),
    ).toBe(true);
  });

  it("never exceeds the headline limit the schema enforces", () => {
    const inputs = [
      "x".repeat(200),
      "word ".repeat(60),
      "Context Here: " + "long ".repeat(40),
    ];
    for (const input of inputs)
      expect(condenseToHeadline(input).length).toBeLessThanOrEqual(
        MAX_THUMBNAIL_HEADLINE_LENGTH,
      );
  });

  it("returns empty for empty or whitespace input", () => {
    expect(condenseToHeadline("")).toBe("");
    expect(condenseToHeadline("   ")).toBe("");
  });

  it("is deterministic", () => {
    const input = "Structural Engineering: The Signs Everyone Missed";
    expect(condenseToHeadline(input)).toBe(condenseToHeadline(input));
  });
});

describe("buildHeadlineOptions", () => {
  it("derives options from titles, then the brief", () => {
    const options = buildHeadlineOptions({
      titles: ["Bridges Are Failing"],
      hookAngle: "The warning signs everyone missed",
      topic: "Why bridges collapse",
    });
    expect(options).toEqual([
      "Bridges Are Failing",
      "The warning signs everyone missed",
      "Why bridges collapse",
    ]);
  });

  it("deduplicates case-insensitively", () => {
    const options = buildHeadlineOptions({
      titles: ["Bridges Are Failing", "BRIDGES ARE FAILING"],
      hookAngle: "",
      topic: "",
    });
    expect(options).toEqual(["Bridges Are Failing"]);
  });

  it("skips empty sources", () => {
    expect(
      buildHeadlineOptions({ titles: ["", "  "], hookAngle: "", topic: "" }),
    ).toEqual([]);
  });

  it("caps the number of options", () => {
    const options = buildHeadlineOptions({
      titles: Array.from({ length: 20 }, (_, index) => `Headline ${index}`),
      hookAngle: "Hook",
      topic: "Topic",
    });
    expect(options).toHaveLength(MAX_HEADLINE_OPTIONS);
  });

  it("produces only options the generate schema will accept", () => {
    const options = buildHeadlineOptions({
      titles: ["An Extremely Long Title ".repeat(10)],
      hookAngle: "y".repeat(120),
      topic: "z".repeat(120),
    });
    for (const option of options) {
      expect(option.length).toBeLessThanOrEqual(MAX_THUMBNAIL_HEADLINE_LENGTH);
      expect(option.trim()).toBe(option);
    }
  });
});
