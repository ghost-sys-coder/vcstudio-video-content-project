import { describe, expect, it } from "vitest";
import { parseScriptStructure } from "@/lib/domain/script-structure";
import { toSceneAnalysisSegmentHints } from "@/lib/scenes/script-segment-hints";

const SCRIPT = `# SCRIPT

Scene 01: The Invisible System Drain
Timestamp: 0:00 - 0:30 (30 sec)
Tone Directive: Curious, tense, intriguing
Pacing Guidance: Deliberate, building suspense
Key Vocal Emphasis: 40 hours a week, poorer, missing piece

NARRATION SCRIPT:

"You work 40 hours a week... and pay your bills on time. [PAUSE: 0.5s] Yet every single year, you feel poorer."

Scene 02: Unzipping the Machine
Timestamp: 0:30 - 1:00 (30 sec)
Tone Directive: Eye-opening, authoritative
Pacing Guidance: Steady, clear
Key Vocal Emphasis: machine, blueprint

NARRATION SCRIPT:

"But here is the secret: the economy isn't weather. It's a machine. [PAUSE: 0.5s] And once you see the blueprint, everything changes."
`;

describe("scripts written as labelled scenes", () => {
  const structure = parseScriptStructure(SCRIPT);

  it("finds each scene with its title and timing", () => {
    expect(structure.isStructured).toBe(true);
    expect(structure.hasSegmentHeadings).toBe(true);
    expect(
      structure.segments.map((segment) => [
        segment.number,
        segment.title,
        segment.timecode?.startSeconds,
        segment.timecode?.endSeconds,
      ]),
    ).toEqual([
      [1, "The Invisible System Drain", 0, 30],
      [2, "Unzipping the Machine", 30, 60],
    ]);
  });

  it("speaks only the narration, never the labels or the document title", () => {
    expect(structure.segments[0]?.narration).toBe(
      "You work 40 hours a week... and pay your bills on time. [PAUSE: 0.5s] Yet every single year, you feel poorer.",
    );
    expect(structure.narration).not.toMatch(
      /SCRIPT\n|Tone Directive|Pacing Guidance|Key Vocal Emphasis|Timestamp/,
    );
    // A colon inside spoken text is not mistaken for a label.
    expect(structure.segments[1]?.narration).toContain(
      "But here is the secret: the economy",
    );
  });

  it("keeps each scene's delivery direction", () => {
    expect(structure.segments.map((segment) => segment.voice)).toEqual([
      {
        tone: "Curious, tense, intriguing",
        pacing: "Deliberate, building suspense",
        emphasis: ["40 hours a week", "poorer", "missing piece"],
      },
      {
        tone: "Eye-opening, authoritative",
        pacing: "Steady, clear",
        emphasis: ["machine", "blueprint"],
      },
    ]);
  });

  it("hands analysis the creator's own scenes, carrying their direction", () => {
    const hints = toSceneAnalysisSegmentHints(structure);
    expect(hints).toHaveLength(2);
    expect(hints[0]?.voice?.tone).toBe("Curious, tense, intriguing");
    expect(hints[0]?.direction).toContain("Tone Directive: Curious");
  });

  it("accepts markdown headings, bold labels, and narration without a label line", () => {
    const loose = parseScriptStructure(`## **Scene 1 - Hook**
**Tone:** Warm
Hello there. [PAUSE] Welcome.

## **Scene 2 - Close**
**Pacing:** Slow
Goodbye.`);
    expect(loose.segments.map((segment) => segment.narration)).toEqual([
      "Hello there. [PAUSE] Welcome.",
      "Goodbye.",
    ]);
    expect(loose.segments[0]?.voice?.tone).toBe("Warm");
    expect(loose.segments[1]?.voice?.pacing).toBe("Slow");
  });

  it("is not claimed for a script that merely mentions a scene once", () => {
    const plain = parseScriptStructure(
      "Scene 1: where it all began.\nThe rest is ordinary narration.",
    );
    expect(plain.segments).toHaveLength(1);
    expect(plain.segments[0]?.voice).toBeUndefined();
    expect(plain.narration).toContain("Scene 1: where it all began.");
  });

  it("keeps text written before the first scene rather than dropping it", () => {
    const withIntro = parseScriptStructure(`Cold open line.

Scene 1: One
Narration one.

Scene 2: Two
Narration two.`);
    expect(withIntro.segments[0]?.narration).toBe(
      "Cold open line.\n\nNarration one.",
    );
  });
});

describe("pause markers in bracket-style scripts", () => {
  it("stay in the narration instead of being dropped as direction", () => {
    const structure = parseScriptStructure(
      "[VISUAL] A vault.\n[VOICEOVER] Money moves. [PAUSE: 0.5s] Then it stops.",
    );
    expect(structure.narration).toBe(
      "Money moves. [PAUSE: 0.5s] Then it stops.",
    );
    expect(structure.unrecognizedMarkers).not.toContain("PAUSE");
  });
});

describe("raised-voice markers in bracket-style scripts", () => {
  it("stay in the narration, and do not cut the rest of the line", () => {
    const structure = parseScriptStructure(
      "[VISUAL] A crowd.\n[VOICEOVER] It runs on [RAISE]confidence[/RAISE]. [PAUSE] And it breaks.",
    );
    expect(structure.narration).toBe(
      "It runs on [RAISE]confidence[/RAISE]. [PAUSE] And it breaks.",
    );
  });
});
