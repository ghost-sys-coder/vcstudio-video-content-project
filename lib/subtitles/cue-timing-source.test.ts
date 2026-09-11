import { describe, expect, it } from "vitest";
import {
  describeCueTimingSource,
  summarizeTrackTimingSource,
  type CueTimingSource,
} from "@/lib/subtitles/cue-timing-source";

const SOURCES: CueTimingSource[] = ["estimated", "pause_adjusted", "manual"];

describe("the vocabulary this application is allowed to use", () => {
  it("never claims captions are aligned, synced or accurate", () => {
    // The guard for the acceptance criterion. Nothing here has ever been
    // compared against speech, so no wording may imply it was. A fourth source
    // must be a deliberate edit to the module, not a phrase that drifts in.
    const forbidden = ["align", "sync", "accurate", "exact", "precise"];
    for (const source of SOURCES) {
      const described = describeCueTimingSource(source);
      const text = `${described.label} ${described.detail}`.toLowerCase();
      for (const word of forbidden) expect(text).not.toContain(word);
    }
  });

  it("says outright that estimated timing never listened to the audio", () => {
    expect(describeCueTimingSource("estimated").detail).toContain(
      "Nothing listened to the narration",
    );
  });

  it("limits the pause claim to the breaks, not the words inside a line", () => {
    const detail = describeCueTimingSource("pause_adjusted").detail;
    expect(detail).toContain("still spread by character count");
  });

  it("gives every source a label and a detail", () => {
    for (const source of SOURCES) {
      const described = describeCueTimingSource(source);
      expect(described.label.length).toBeGreaterThan(0);
      expect(described.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("summarizing a whole track", () => {
  it("reports the weakest source present, never the best", () => {
    // Being told "snapped to pauses" and then finding two untouched scenes is
    // a worse answer than being told "estimated".
    expect(summarizeTrackTimingSource(["manual", "estimated"])).toBe(
      "estimated",
    );
    expect(summarizeTrackTimingSource(["manual", "pause_adjusted"])).toBe(
      "pause_adjusted",
    );
  });

  it("reports manual only when every cue was set by hand", () => {
    expect(summarizeTrackTimingSource(["manual", "manual"])).toBe("manual");
  });

  it("treats an empty track as estimated rather than as anything better", () => {
    expect(summarizeTrackTimingSource([])).toBe("estimated");
  });
});
