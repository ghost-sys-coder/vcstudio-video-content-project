import { describe, expect, it } from "vitest";
import {
  isSubstantiveMarketingEdit,
  normalizedEditDistance,
} from "@/lib/marketing/metrics/substantive-edit";

describe("substantive marketing edits", () => {
  it("ignores casing and whitespace-only changes", () => {
    expect(
      normalizedEditDistance(
        "A useful launch post",
        "  a USEFUL   launch post ",
      ),
    ).toBe(0);
  });

  it("uses the documented twenty-percent normalized distance threshold", () => {
    expect(
      isSubstantiveMarketingEdit({
        originalText: "abcdef",
        revisedText: "abcxef",
        originalStructuredPayload: null,
        revisedStructuredPayload: null,
      }),
    ).toBe(false);
    expect(
      isSubstantiveMarketingEdit({
        originalText: "abcdefghij",
        revisedText: "abcXYZghij",
        originalStructuredPayload: null,
        revisedStructuredPayload: null,
      }),
    ).toBe(true);
  });

  it("treats a material structured-field change as substantive", () => {
    expect(
      isSubstantiveMarketingEdit({
        originalText: "Same copy",
        revisedText: "Same copy",
        originalStructuredPayload: { callToAction: "Learn" },
        revisedStructuredPayload: { callToAction: "Buy" },
      }),
    ).toBe(true);
  });
});
