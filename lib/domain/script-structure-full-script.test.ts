import { describe, expect, it } from "vitest";
import { parseScriptStructure } from "@/lib/domain/script-structure";
import { FULL_PASTED_SCRIPT } from "@/lib/test-utils/full-pasted-script-fixture";

/**
 * The end-to-end check on a whole real script, rather than on hand-made
 * snippets. What matters is that the narration a narrator would be given
 * contains every spoken word and nothing else.
 */
describe("a complete creator-pasted script", () => {
  const parsed = parseScriptStructure(FULL_PASTED_SCRIPT);

  it("reads every segment the creator wrote, and no more", () => {
    expect(parsed.segments).toHaveLength(7);
    expect(parsed.segments.map((segment) => segment.timecode?.raw)).toEqual([
      "0:00 - 1:15",
      "1:15 - 2:45",
      "2:45 - 4:15",
      "4:15 - 5:45",
      "5:45 - 7:15",
      "7:15 - 8:45",
      "8:45 - End",
    ]);
    expect(parsed.segments[6]?.title).toBe(
      "Outro: The 7-Day Protocol Challenge",
    );
  });

  it("gives every segment something to say", () => {
    // A segment with no narration would render silently, so an empty one is a
    // parsing failure rather than a valid outcome for this script.
    for (const segment of parsed.segments)
      expect(segment.narration.length).toBeGreaterThan(0);
  });

  it("hands the narrator only spoken words", () => {
    const forbidden = [
      "VISUAL",
      "TEXT OVERLAY",
      "SOUND EFFECT",
      "SFX",
      "VOICEOVER",
      "A-ROLL",
      "Split screen",
      "Fast-paced, high-quality",
      "Low cinematic boom",
      "THE 21-DAY LIE",
      "Keystone Habit Selected",
      "Inputs Logged",
      "[",
      "]",
    ];
    for (const term of forbidden) expect(parsed.narration).not.toContain(term);
  });

  it("keeps the opening and closing spoken lines intact", () => {
    expect(parsed.narration.startsWith("Every productivity guru online")).toBe(
      true,
    );
    expect(parsed.narration.endsWith("We'll see you next week.")).toBe(true);
  });

  it("excludes a substantial amount of direction from what would be spoken", () => {
    // This is the cost and quality argument in one number: over a thousand
    // characters that would otherwise have been synthesised and billed.
    expect(parsed.excludedCharacterCount).toBeGreaterThan(1000);
    expect(parsed.narration.length).toBeLessThan(FULL_PASTED_SCRIPT.length);
  });

  it("recognises every marker the script used", () => {
    expect(parsed.unrecognizedMarkers).toEqual([]);
    expect(parsed.excludedMarkers.sort()).toEqual([
      "SOUND EFFECT (SFX)",
      "TEXT OVERLAY",
      "VISUAL",
    ]);
  });
});
