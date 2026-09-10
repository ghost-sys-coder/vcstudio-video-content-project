import { describe, expect, it } from "vitest";
import {
  classifyScriptMarker,
  extractNarration,
  parseScriptStructure,
  parseScriptTimecode,
} from "@/lib/domain/script-structure";
import {
  PLAIN_SCRIPT_FIXTURE,
  STRUCTURED_SCRIPT_FIXTURE,
} from "@/lib/test-utils/structured-script-fixture";

describe("a script with no markers keeps behaving exactly as before", () => {
  it("treats the whole document as narration", () => {
    const parsed = parseScriptStructure(PLAIN_SCRIPT_FIXTURE);
    expect(parsed.isStructured).toBe(false);
    expect(parsed.narration).toBe(PLAIN_SCRIPT_FIXTURE.trim());
    expect(parsed.excludedMarkers).toEqual([]);
    expect(parsed.excludedCharacterCount).toBe(0);
  });

  it("leaves bracketed prose in the narration", () => {
    // Lower-case brackets are an aside a narrator reads, not a direction.
    const script = "We tried it [and it worked] the first time.";
    expect(extractNarration(script)).toBe(script);
  });

  it("keeps an empty script empty rather than inventing a segment", () => {
    expect(extractNarration("")).toBe("");
  });
});

describe("the creator's own script is read, never rewritten", () => {
  const parsed = parseScriptStructure(STRUCTURED_SCRIPT_FIXTURE);

  it("recognises the segments the creator already wrote", () => {
    // The whole point: the segments exist in the document, so they are read
    // rather than invented a second time.
    expect(parsed.isStructured).toBe(true);
    expect(parsed.hasSegmentHeadings).toBe(true);
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments.map((segment) => segment.title)).toEqual([
      "Hook: The 7-Day Reset",
      "Habit 1: The Keystone Protocol",
      "Outro: The 7-Day Protocol Challenge",
    ]);
  });

  it("reads the creator's timings, including an open-ended ending", () => {
    expect(parsed.segments[0]?.timecode?.startSeconds).toBe(0);
    expect(parsed.segments[0]?.timecode?.endSeconds).toBe(75);
    expect(parsed.segments[1]?.timecode?.startSeconds).toBe(75);
    expect(parsed.segments[2]?.timecode?.startSeconds).toBe(525);
    expect(parsed.segments[2]?.timecode?.endSeconds).toBeNull();
  });

  it("never lets production direction reach the narration", () => {
    // The specific failure this prevents: a narrator reading "TEXT OVERLAY"
    // or a description of the B-roll aloud, and being billed for it.
    const narration = parsed.narration;
    expect(narration).not.toContain("VISUAL");
    expect(narration).not.toContain("TEXT OVERLAY");
    expect(narration).not.toContain("SOUND EFFECT");
    expect(narration).not.toContain("VOICEOVER");
    expect(narration).not.toContain("A-ROLL");
    expect(narration).not.toContain("THE 21-DAY LIE");
    expect(narration).not.toContain("Fast-paced, high-quality");
    expect(narration).not.toContain("Low cinematic boom");
    expect(narration).not.toContain("[");
  });

  it("keeps every spoken word, including paragraphs after the marker", () => {
    // Narration continues across blank lines until the next marker, so the
    // second and third paragraphs under one voiceover marker are kept.
    expect(parsed.narration).toContain(
      "Every productivity guru online will tell you",
    );
    expect(parsed.narration).toContain("The system collapses before Friday.");
    expect(parsed.narration).toContain(
      "What if the secret isn't a long-term trial",
    );
    expect(parsed.narration).toContain(
      "One small lever moves the entire mountain.",
    );
    expect(parsed.narration).toContain(
      "Build the system. We'll see you next week.",
    );
  });

  it("does not treat a segment heading as something to speak", () => {
    expect(parsed.narration).not.toContain("Hook: The 7-Day Reset");
    expect(parsed.narration).not.toContain("Outro:");
  });

  it("separates direction that shares a line with other direction", () => {
    // The hook's first line carries VISUAL, TEXT OVERLAY and SFX together.
    const hook = parsed.segments[0];
    expect(hook?.directives.map((entry) => entry.kind)).toEqual([
      "visual",
      "overlay",
      "audio",
    ]);
    expect(hook?.directives[1]?.text).toBe("THE 21-DAY LIE");
    expect(hook?.directives[2]?.text).toBe(
      "Low cinematic boom, followed by a ticking clock.",
    );
  });

  it("keeps the creator's visual direction available rather than discarding it", () => {
    // Excluded from narration is not the same as thrown away: the imagery
    // direction is the creator's and downstream stages should use it.
    expect(parsed.segments[0]?.directives[0]?.text).toContain(
      "close-up of a calendar",
    );
  });

  it("holds an on-screen list under the overlay it belongs to", () => {
    // The outro's checklist follows a TEXT OVERLAY marker, so it is on-screen
    // text and must not be read aloud.
    expect(parsed.narration).not.toContain("Keystone Habit Selected");
    const outro = parsed.segments[2];
    const overlay = outro?.directives.find((entry) => entry.kind === "overlay");
    expect(overlay?.text).toContain("Keystone Habit Selected");
    expect(overlay?.text).toContain("Focus Space Built");
  });

  it("reports what it removed so a creator can check it", () => {
    expect(parsed.excludedMarkers).toContain("VISUAL");
    expect(parsed.excludedMarkers).toContain("TEXT OVERLAY");
    expect(parsed.excludedMarkers).toContain("SOUND EFFECT (SFX)");
    expect(parsed.unrecognizedMarkers).toEqual([]);
    expect(parsed.excludedCharacterCount).toBeGreaterThan(0);
  });

  it("leaves the original document untouched", () => {
    // Nothing in the module may edit the creator's script.
    const before = STRUCTURED_SCRIPT_FIXTURE;
    parseScriptStructure(before);
    expect(STRUCTURED_SCRIPT_FIXTURE).toBe(before);
  });
});

describe("classifyScriptMarker", () => {
  it("reads a combined voiceover label as spoken", () => {
    // "A-ROLL" appears after "VOICEOVER" in the same label and must not pull
    // the whole marker into production direction.
    expect(classifyScriptMarker("VOICEOVER / HOST (A-ROLL)")).toBe("narration");
    expect(classifyScriptMarker("HOST")).toBe("narration");
    expect(classifyScriptMarker("VO")).toBe("narration");
    expect(classifyScriptMarker("NARRATOR")).toBe("narration");
  });

  it("keeps A-roll and B-roll apart", () => {
    expect(classifyScriptMarker("A-ROLL")).toBe("narration");
    expect(classifyScriptMarker("B-ROLL")).toBe("visual");
  });

  it("classifies the common production labels", () => {
    expect(classifyScriptMarker("VISUAL")).toBe("visual");
    expect(classifyScriptMarker("CUT TO")).toBe("visual");
    expect(classifyScriptMarker("TEXT OVERLAY")).toBe("overlay");
    expect(classifyScriptMarker("LOWER THIRD")).toBe("overlay");
    expect(classifyScriptMarker("SOUND EFFECT (SFX)")).toBe("audio");
    expect(classifyScriptMarker("MUSIC")).toBe("audio");
  });

  it("admits when a marker is not in its vocabulary", () => {
    expect(classifyScriptMarker("WARDROBE")).toBe("unknown");
  });
});

describe("an unfamiliar marker is excluded but reported", () => {
  it("keeps it out of narration and names it for review", () => {
    // Silently speaking an unknown direction is worse than excluding it, but
    // excluding it silently is also wrong, so it is surfaced.
    const parsed = parseScriptStructure(
      "[WARDROBE] Blue shirt.\n[VOICEOVER] Hello there.",
    );
    expect(parsed.narration).toBe("Hello there.");
    expect(parsed.unrecognizedMarkers).toEqual(["WARDROBE"]);
    expect(parsed.excludedMarkers).toContain("WARDROBE");
  });
});

describe("parseScriptTimecode", () => {
  it("reads minute and hour forms and an open ending", () => {
    expect(parseScriptTimecode("0:00 - 1:15")?.endSeconds).toBe(75);
    expect(parseScriptTimecode("1:02:03 - 1:02:05")?.startSeconds).toBe(3723);
    expect(parseScriptTimecode("8:45 - End")?.endSeconds).toBeNull();
    expect(parseScriptTimecode("8:45 – End")?.startSeconds).toBe(525);
  });

  it("rejects anything that is not a timecode range", () => {
    expect(parseScriptTimecode("VISUAL")).toBeNull();
    expect(parseScriptTimecode("0:00")).toBeNull();
    expect(parseScriptTimecode("1:99 - 2:00")).toBeNull();
  });
});

describe("narration before any marker is still narration", () => {
  it("keeps an opening paragraph that precedes the first direction", () => {
    const parsed = parseScriptStructure(
      "Welcome back to the channel.\n\n[VISUAL] Wide shot.\n[VOICEOVER] Today we begin.",
    );
    expect(parsed.narration).toContain("Welcome back to the channel.");
    expect(parsed.narration).toContain("Today we begin.");
    expect(parsed.narration).not.toContain("Wide shot");
  });
});
