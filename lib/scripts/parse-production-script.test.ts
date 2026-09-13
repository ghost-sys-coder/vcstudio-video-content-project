import { describe, expect, it } from "vitest";
import { parseProductionScript } from "@/lib/scripts/parse-production-script";

describe("the script that broke scene analysis", () => {
  // Shortened from a real approved script whose analysis failed with "Scene 1
  // narration does not appear in the approved script at character 0", because
  // character 0 was a stage direction nobody says out loud.
  const script = `[SCENE START]

[VISUAL CUE: Fast-paced montage of a bank vault opening, stock ticker charts.]

HOST (ON CAMERA):
If you've ever looked at rising grocery bills and thought, "Who is pulling the strings?"—you're not alone.

Most people view the economy as a chaotic weather system. But the truth? It's a machine.

[GRAPHIC OVERLAY: Roadmap:
1. The Circular Flow Engine
2. The Inflation Trap]

---

[SECTION 1: THE CIRCULAR FLOW ENGINE]

HOST (VOICEOVER):
To understand macroeconomics, forget complex formulas.`;

  it("starts the narration with the first spoken word", () => {
    // This is the whole bug: coverage walks from character zero, and character
    // zero used to be "[SCENE START]".
    const parsed = parseProductionScript(script);
    expect(parsed.narration.startsWith("If you've ever looked")).toBe(true);
  });

  it("keeps every spoken passage", () => {
    const parsed = parseProductionScript(script);
    expect(parsed.narration).toContain("Who is pulling the strings?");
    expect(parsed.narration).toContain("It's a machine.");
    expect(parsed.narration).toContain("forget complex formulas.");
  });

  it("removes the production furniture, and nothing else", () => {
    const parsed = parseProductionScript(script);
    const kinds = parsed.removed.map((segment) => segment.kind);
    expect(kinds).toContain("direction");
    expect(kinds).toContain("speaker");
    expect(kinds).toContain("rule");
    expect(parsed.narration).not.toContain("VISUAL CUE");
    expect(parsed.narration).not.toContain("HOST");
    expect(parsed.narration).not.toContain("---");
  });

  it("keeps the directions rather than discarding them", () => {
    // They are exactly what the storyboard wants to know, so throwing them away
    // would trade one problem for another.
    const parsed = parseProductionScript(script);
    const directions = parsed.removed.filter(
      (segment) => segment.kind === "direction",
    );
    expect(directions.length).toBeGreaterThanOrEqual(3);
    expect(directions[1]?.text).toContain("bank vault");
  });

  it("says where each direction belonged", () => {
    // Offsets into the cleaned narration, so a direction can be attached to the
    // passage it described instead of floating loose.
    const parsed = parseProductionScript(script);
    const offsets = parsed.removed.map((segment) => segment.narrationOffset);
    expect(offsets[0]).toBe(0);
    expect(Math.max(...offsets)).toBeGreaterThan(0);
  });

  it("captures a bracketed block that spans several lines", () => {
    const parsed = parseProductionScript(script);
    const overlay = parsed.removed.find((segment) =>
      segment.text.includes("GRAPHIC OVERLAY"),
    );
    expect(overlay?.text).toContain("The Inflation Trap");
  });
});

describe("leaving a plain narration script alone", () => {
  it("removes nothing and says so", () => {
    const parsed = parseProductionScript(
      "We begin here.\n\nAnd then we continue.",
    );
    expect(parsed.wasAlreadyNarration).toBe(true);
    expect(parsed.narration).toBe("We begin here.\n\nAnd then we continue.");
  });
});

describe("being conservative where a line is ambiguous", () => {
  it("keeps an ordinary sentence that ends in a colon", () => {
    // "Here's the catch:" is narration. Requiring a speaker label to carry no
    // lowercase letters is what tells the two apart.
    const parsed = parseProductionScript("Here's the catch:\nmoney moves.");
    expect(parsed.narration).toContain("Here's the catch:");
    expect(parsed.wasAlreadyNarration).toBe(true);
  });

  it("keeps a bracketed aside inside a sentence", () => {
    const parsed = parseProductionScript(
      "The rate rose [it had fallen before] by two points.",
    );
    expect(parsed.narration).toContain("[it had fallen before]");
  });

  it("does not swallow the script when a bracket is never closed", () => {
    // The worst possible failure: one forgotten bracket eating everything after
    // it. A stray bracket left in the narration is obvious and fixable.
    const parsed = parseProductionScript(
      "[VISUAL CUE: something\n\nThe economy is a machine.\n\nAnd it runs on rules.",
    );
    expect(parsed.narration).toContain("The economy is a machine.");
    expect(parsed.narration).toContain("And it runs on rules.");
  });

  it("keeps a numbered list that is spoken", () => {
    const parsed = parseProductionScript("First, households.\nSecond, firms.");
    expect(parsed.narration).toContain("First, households.");
    expect(parsed.narration).toContain("Second, firms.");
  });
});

describe("the shape of what comes out", () => {
  it("joins wrapped lines into one spoken paragraph", () => {
    // Narration is read aloud, so a line break inside a paragraph is layout.
    const parsed = parseProductionScript("One line\nwrapped here.\n\nNext.");
    expect(parsed.narration).toBe("One line wrapped here.\n\nNext.");
  });

  it("produces nothing at all from a script that is only direction", () => {
    const parsed = parseProductionScript("[VISUAL CUE: a vault]\n\nHOST:");
    expect(parsed.narration).toBe("");
    expect(parsed.removed).toHaveLength(2);
  });

  it("handles an empty script without inventing anything", () => {
    const parsed = parseProductionScript("");
    expect(parsed.narration).toBe("");
    expect(parsed.wasAlreadyNarration).toBe(true);
  });

  it("treats Windows line endings the same as Unix ones", () => {
    const parsed = parseProductionScript("HOST:\r\nWe begin.\r\n");
    expect(parsed.narration).toBe("We begin.");
  });
});
