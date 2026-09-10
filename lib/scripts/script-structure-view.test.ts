import { describe, expect, it } from "vitest";
import { buildScriptStructureView } from "@/lib/scripts/script-structure-view";
import {
  PLAIN_SCRIPT_FIXTURE,
  STRUCTURED_SCRIPT_FIXTURE,
} from "@/lib/test-utils/structured-script-fixture";

describe("buildScriptStructureView", () => {
  it("stays out of the way for an ordinary script", () => {
    const view = buildScriptStructureView(PLAIN_SCRIPT_FIXTURE);
    expect(view.detected).toBe(false);
    expect(view.rows).toEqual([]);
  });

  it("names the creator's scenes and what will not be spoken", () => {
    const view = buildScriptStructureView(STRUCTURED_SCRIPT_FIXTURE);
    expect(view.detected).toBe(true);
    expect(view.segmentCount).toBe(3);
    expect(view.rows[0]?.label).toBe("Hook: The 7-Day Reset");
    expect(view.rows[0]?.excludedHere).toBe(
      "VISUAL, TEXT OVERLAY, SOUND EFFECT (SFX)",
    );
    expect(view.excludedCharacterCount).toBeGreaterThan(0);
    expect(view.needsReview).toBe(false);
  });

  it("previews what each scene will actually say", () => {
    const view = buildScriptStructureView(STRUCTURED_SCRIPT_FIXTURE);
    expect(
      view.rows[0]?.narrationPreview.startsWith("Every productivity guru"),
    ).toBe(true);
    expect(view.rows[0]?.narrationPreview).not.toContain("VISUAL");
    expect(view.rows[0]?.silent).toBe(false);
  });

  it("asks for a look when a scene has nothing spoken", () => {
    // Silently producing a soundless scene would be worse than saying so.
    const view = buildScriptStructureView(
      "[0:00 - 0:10] Cold open\n[VISUAL] A door opens.",
    );
    expect(view.rows[0]?.silent).toBe(true);
    expect(view.needsReview).toBe(true);
  });

  it("asks for a look when a marker is outside the vocabulary", () => {
    const view = buildScriptStructureView(
      "[WARDROBE] Blue shirt.\n[VOICEOVER] Hello there.",
    );
    expect(view.unrecognizedMarkers).toEqual(["WARDROBE"]);
    expect(view.needsReview).toBe(true);
  });

  it("reports direction with no headings as direction only", () => {
    const view = buildScriptStructureView(
      "[VISUAL] A wide shot.\n[VOICEOVER] Hello there.",
    );
    expect(view.detected).toBe(true);
    expect(view.directionOnly).toBe(true);
  });
});
