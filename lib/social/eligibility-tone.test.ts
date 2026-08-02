import { describe, expect, it } from "vitest";

import {
  presentEligibility,
  toneClassName,
  toneContainerClassName,
} from "@/lib/social/eligibility-tone";

describe("presentEligibility", () => {
  it("names the platform when it is ready", () => {
    const presentation = presentEligibility(
      { platform: "linkedin", eligible: true },
      "LinkedIn",
    );
    expect(presentation.tone).toBe("ready");
    expect(presentation.message).toBe("Ready for LinkedIn.");
  });

  it("presents an unmet requirement neutrally", () => {
    const presentation = presentEligibility(
      {
        platform: "youtube",
        eligible: false,
        reason: "Needs one video.",
        severity: "requirement",
        detail: "Community posts have no public API.",
      },
      "YouTube",
    );
    expect(presentation.tone).toBe("info");
    expect(presentation.className).toBe(toneClassName("info"));
    expect(presentation.detail).toBe("Community posts have no public API.");
  });

  it("warns about a broken limit without using the destructive tone", () => {
    const presentation = presentEligibility(
      {
        platform: "twitter",
        eligible: false,
        reason: "That is 2,500 characters; the limit here is 2,000.",
        severity: "violation",
      },
      "X",
    );
    expect(presentation.tone).toBe("warning");
    // Destructive red stays reserved for operations that actually failed, so a
    // draft-time warning must never borrow it.
    expect(presentation.className).not.toContain("destructive");
    expect(presentation.detail).toBeUndefined();
  });

  it("gives a requirement and a violation visibly different tones", () => {
    expect(toneClassName("info")).not.toBe(toneClassName("warning"));
  });

  it("renders every tone as a filled block so a notice is not lost in the page", () => {
    for (const tone of ["ready", "info", "warning"] as const) {
      const container = toneContainerClassName(tone);
      expect(container).toContain("bg-");
      expect(container).toContain("rounded-lg");
    }
  });

  it("gives a violation and a requirement different fills", () => {
    // The hierarchy is the point: only a violation asks the author to act, so a
    // blank composer's three media requirements must not shout as loudly.
    expect(toneContainerClassName("warning")).toContain("bg-notice-warning");
    expect(toneContainerClassName("info")).toContain("bg-notice-info");
  });

  it("builds every tone from theme tokens rather than dark: variants", () => {
    // A `dark:` variant does not reach the `dim` theme, so a tone built from
    // palette utilities would render at its light colour on a dark surface.
    for (const tone of ["ready", "info", "warning"] as const) {
      expect(toneContainerClassName(tone)).not.toContain("dark:");
      expect(toneClassName(tone)).not.toContain("dark:");
    }
  });

  it("carries the block classes on the presentation itself", () => {
    const presentation = presentEligibility(
      {
        platform: "youtube",
        eligible: false,
        reason: "Needs one video.",
        severity: "requirement",
      },
      "YouTube",
    );
    expect(presentation.containerClassName).toBe(
      toneContainerClassName("info"),
    );
  });
});
