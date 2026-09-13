import { describe, expect, it } from "vitest";
import {
  extractNarration,
  parseScriptStructure,
} from "@/lib/domain/script-structure";

/**
 * The conventions that made a real project fail scene analysis twice.
 *
 * The script put its direction *inside* the brackets and named its speaker on
 * a line of its own. Neither was recognised, so the whole document counted as
 * narration, and the scene plan was held to reproducing stage directions. The
 * first run failed with "Scene 1 narration does not appear in the approved
 * script at character 0"; the second, after the script was re-pasted, failed
 * with "Scene 1 has no narration", because the model had read the opening
 * visual cue as a silent establishing shot. One cause, two symptoms.
 */
const SCRIPT = `[SCENE START]

[VISUAL CUE: Fast-paced montage of a bank vault opening, stock ticker charts, and a glowing digital globe.]

HOST (ON CAMERA):
If you've ever looked at rising grocery bills and thought, "Who is pulling the strings?"—you're not alone.

[GRAPHIC OVERLAY: Roadmap:
1. The Circular Flow Engine
2. The Inflation Trap]

---

HOST (VOICEOVER):
To understand macroeconomics, forget complex formulas.`;

describe("direction written inside the brackets", () => {
  it("is recognised, where before the whole script read as narration", () => {
    expect(parseScriptStructure(SCRIPT).isStructured).toBe(true);
  });

  it("starts the narration on the first spoken word", () => {
    // Coverage walks from character zero. Character zero used to be a stage
    // direction, which is exactly why the check failed there.
    expect(extractNarration(SCRIPT).startsWith("If you've ever looked")).toBe(
      true,
    );
  });

  it("keeps every spoken passage", () => {
    const narration = extractNarration(SCRIPT);
    expect(narration).toContain("Who is pulling the strings?");
    expect(narration).toContain("forget complex formulas.");
  });

  it("speaks none of the direction", () => {
    const narration = extractNarration(SCRIPT);
    expect(narration).not.toContain("VISUAL CUE");
    expect(narration).not.toContain("bank vault");
    expect(narration).not.toContain("GRAPHIC OVERLAY");
    expect(narration).not.toContain("HOST");
    expect(narration).not.toContain("---");
  });

  it("keeps the direction rather than discarding it", () => {
    // It is what the storyboard wants to know, so losing it would trade one
    // problem for another.
    const parsed = parseScriptStructure(SCRIPT);
    const markers = parsed.segments.flatMap((segment) => segment.directives);
    expect(
      markers.some((directive) => directive.text.includes("bank vault")),
    ).toBe(true);
  });

  it("reads a bracketed block that runs over several lines", () => {
    expect(extractNarration(SCRIPT)).not.toContain("The Inflation Trap");
  });

  it("classifies the direction by the label before the colon", () => {
    const parsed = parseScriptStructure(
      "[VISUAL CUE: a vault door]\n\nWe begin.",
    );
    expect(parsed.segments[0]?.directives[0]?.kind).toBe("visual");
    expect(parsed.segments[0]?.directives[0]?.text).toBe("a vault door");
  });
});

describe("a speaker named on its own line", () => {
  it("is never spoken, and never silences what follows it", () => {
    const narration = extractNarration("ANNOUNCER:\nThe results are in.");
    expect(narration).toBe("The results are in.");
  });

  it("treats an unrecognised speaker as a speaker, not as direction", () => {
    // The dangerous case. Classifying an unknown name as unknown direction
    // would drop every line that speaker says, silently and unrecoverably.
    const narration = extractNarration(
      "DR. OKONKWO (V.O.):\nInflation is a tax.",
    );
    expect(narration).toContain("Inflation is a tax.");
  });
});

describe("still leaving ordinary writing alone", () => {
  it("keeps a sentence that ends in a colon", () => {
    const narration = extractNarration("Here's the catch:\nmoney moves.");
    expect(narration).toContain("Here's the catch:");
  });

  it("keeps a bracketed aside written in prose", () => {
    const narration = extractNarration(
      "The rate rose [it had fallen before] by two points.",
    );
    expect(narration).toContain("[it had fallen before]");
  });

  it("keeps a bracketed aside that happens to contain a colon", () => {
    const narration = extractNarration(
      "The rule [see chapter two: the basics] still holds.",
    );
    expect(narration).toContain("see chapter two: the basics");
  });

  it("treats a script with no markers as entirely narration", () => {
    const parsed = parseScriptStructure(
      "We begin here.\n\nAnd then we continue.",
    );
    expect(parsed.isStructured).toBe(false);
    expect(parsed.narration).toBe("We begin here.\n\nAnd then we continue.");
  });
});
