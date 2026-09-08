import { describe, expect, it } from "vitest";
import { checkNarrationCoverage } from "@/lib/domain/narration-coverage";

const SCRIPT =
  "Compound interest is quiet at first. Then it is not. Start early and stay invested.";

function check(script: string, sceneNarrations: string[]) {
  return checkNarrationCoverage({ approvedScript: script, sceneNarrations });
}

describe("checkNarrationCoverage — accepted plans", () => {
  it("accepts an in-order plan that covers the script exactly once", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Then it is not.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts a single scene carrying the whole script", () => {
    expect(check(SCRIPT, [SCRIPT]).ok).toBe(true);
  });

  it("accepts splits that fall mid-sentence", () => {
    expect(check("One two three four.", ["One two", "three four."]).ok).toBe(
      true,
    );
  });

  it("ignores harmless formatting differences", () => {
    const result = check("Line one.\n\nLine two.", [
      "  Line one.  ",
      "Line two.​",
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("checkNarrationCoverage — repeated phrases", () => {
  it("accepts a phrase the script genuinely repeats", () => {
    const script = "Stay invested. Markets fall. Stay invested.";
    const result = check(script, [
      "Stay invested.",
      "Markets fall.",
      "Stay invested.",
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects a repeat the script does not contain", () => {
    const script = "Stay invested. Markets fall.";
    const result = check(script, [
      "Stay invested.",
      "Stay invested.",
      "Markets fall.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("duplicated_narration");
    expect(result.discrepancies[0]?.sceneNumber).toBe(2);
  });

  it("rejects covering one occurrence twice and the other not at all", () => {
    // The exact failure a per-passage search would wrongly accept.
    const script = "Stay invested. Markets fall. Stay invested.";
    const result = check(script, ["Stay invested.", "Stay invested."]);
    expect(result.ok).toBe(false);
  });
});

describe("checkNarrationCoverage — rejected plans", () => {
  it("rejects a missing middle passage", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("missing_narration");
    expect(result.summary).toContain("not covered");
  });

  it("rejects an uncovered tail", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Then it is not.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("uncovered_script_tail");
    expect(result.discrepancies[0]?.sceneNumber).toBeNull();
  });

  it("rejects scenes delivered in the wrong order", () => {
    const result = check(SCRIPT, [
      "Then it is not.",
      "Compound interest is quiet at first.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("missing_narration");
  });

  it("reports a passage that belongs earlier as reordered", () => {
    const result = check("One. Two. Three.", ["One. Two.", "One."]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("reordered_narration");
    expect(result.discrepancies[0]?.message).toContain("out of order");
  });

  it("rejects a trailing repeat of an already-covered passage", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Then it is not.",
      "Start early and stay invested.",
      "Then it is not.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("duplicated_narration");
  });

  it("rejects invented narration", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Buy this stock today.",
      "Then it is not.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("invented_narration");
    expect(result.discrepancies[0]?.sceneNumber).toBe(2);
  });

  it("rejects an empty scene narration", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "   ",
      "Then it is not.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.kind).toBe("empty_narration");
  });

  it("rejects an empty plan", () => {
    expect(check(SCRIPT, []).ok).toBe(false);
  });
});

describe("checkNarrationCoverage — punctuation sensitivity", () => {
  it("rejects a changed question mark and reports it as punctuation-only", () => {
    const result = check("Is it worth it? Probably.", [
      "Is it worth it.",
      "Probably.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.punctuationOnly).toBe(true);
    expect(result.discrepancies[0]?.message).toContain("punctuation");
  });

  it("rejects smart-quote substitution rather than folding it away", () => {
    const result = check("It's a “safe” bet.", ['It’s a "safe" bet.']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.punctuationOnly).toBe(true);
  });

  it("does not label a dropped word as punctuation-only", () => {
    const result = check("Buy the index fund.", ["Buy the fund."]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.punctuationOnly).toBe(false);
  });

  it("rejects a negation change", () => {
    expect(
      check("This is not financial advice.", ["This is financial advice."]).ok,
    ).toBe(false);
  });
});

describe("checkNarrationCoverage — multilingual text", () => {
  it("accepts a correct Japanese plan", () => {
    const script = "複利は最初は静かです。しかしその後は違います。";
    const result = check(script, [
      "複利は最初は静かです。",
      "しかしその後は違います。",
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing Japanese passage", () => {
    const script = "複利は最初は静かです。しかしその後は違います。";
    expect(check(script, ["複利は最初は静かです。"]).ok).toBe(false);
  });

  it("accepts Arabic right-to-left narration", () => {
    const script = "الفائدة المركبة هادئة في البداية. ثم لا تكون كذلك.";
    const result = check(script, [
      "الفائدة المركبة هادئة في البداية.",
      "ثم لا تكون كذلك.",
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts decomposed Spanish accents from the provider", () => {
    // The script below uses composed accents (U+00E9) while the scene
    // narration uses combining marks (e + U+0301). They look identical; do not
    // "tidy" them to match, or this stops testing NFC at all.
    const script = "El interés compuesto es tranquilo. Después no lo es.";
    const result = check(script, [
      "El interés compuesto es tranquilo.",
      "Después no lo es.",
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects a changed German word", () => {
    const script = "Zinseszins ist am Anfang leise.";
    expect(check(script, ["Zinseszins ist am Ende leise."]).ok).toBe(false);
  });
});

describe("checkNarrationCoverage — boundary whitespace", () => {
  it("accepts leading and trailing whitespace on the script and scenes", () => {
    const result = check("\n  First. Second.  \n", ["\tFirst.", "Second.\n"]);
    expect(result.ok).toBe(true);
  });

  it("accepts a script whose passages are separated by newlines", () => {
    const result = check("First.\nSecond.\nThird.", [
      "First.",
      "Second.",
      "Third.",
    ]);
    expect(result.ok).toBe(true);
  });

  it("reports the offset where coverage broke down", () => {
    const result = check(SCRIPT, [
      "Compound interest is quiet at first.",
      "Start early and stay invested.",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.discrepancies[0]?.scriptCharacterOffset).toBe(37);
    expect(result.discrepancies[0]?.expectedExcerpt).toContain(
      "Then it is not.",
    );
    expect(result.coveredCharacters).toBe(37);
  });
});
