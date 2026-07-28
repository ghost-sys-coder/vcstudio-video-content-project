import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE,
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
  CHARACTER_REFERENCE_PROMPT_VERSION,
  renderCharacterReferencePrompt,
  type CharacterReferencePromptInput,
} from "./character-reference";

const input: CharacterReferencePromptInput = {
  character: {
    name: "Detective Kane",
    description: "A seasoned investigator.",
    visualIdentity: "Weathered trench coat, sharp eyes.",
    bodyProportions: "Tall, broad-shouldered.",
    faceDescription: "Square jaw, greying stubble.",
    hairDescription: "Short salt-and-pepper hair.",
    skinToneDescription: "Olive.",
    defaultOutfitDescription: "Charcoal trench coat over a grey shirt.",
    negativeConstraints: "No hat, no sunglasses.",
  },
  referenceType: "front",
  output: { width: 1024, height: 1024 },
};

describe("character reference prompt", () => {
  it("pins the source hash to the versioned template", () => {
    expect(
      createHash("sha256")
        .update(CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE)
        .digest("hex"),
    ).toBe(CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH);
    expect(CHARACTER_REFERENCE_PROMPT_VERSION).toBe("character-reference-v3");
  });

  it("renders deterministically with every identity and framing layer", () => {
    const first = renderCharacterReferencePrompt(input);
    expect(renderCharacterReferencePrompt(input)).toBe(first);
    expect(first).toContain("<global_portrait_framing>");
    expect(first).toContain("<character_identity>");
    expect(first).toContain("Detective Kane");
    expect(first).toContain("Charcoal trench coat over a grey shirt.");
    expect(first).toContain("- Requested view: front");
    expect(first).toContain("No hat, no sunglasses.");
    expect(first).toContain("1024x1024 pixels");
  });

  it("varies framing by requested view", () => {
    const front = renderCharacterReferencePrompt(input);
    const fullBody = renderCharacterReferencePrompt({
      ...input,
      referenceType: "fullBody",
      output: { width: 1024, height: 1536 },
    });
    expect(front).not.toBe(fullBody);
    expect(fullBody).toContain("full-body");
    expect(fullBody).toContain("- Requested view: fullBody");
  });

  it("adds the matched-set consistency clause only for animation pose views", () => {
    const front = renderCharacterReferencePrompt(input);
    const poseIdle = renderCharacterReferencePrompt({
      ...input,
      referenceType: "poseIdle",
    });
    const poseTalkOpen = renderCharacterReferencePrompt({
      ...input,
      referenceType: "poseTalkOpen",
    });
    expect(front).not.toContain("matched set of pose stills");
    expect(poseIdle).toContain("matched set of pose stills");
    expect(poseTalkOpen).toContain("matched set of pose stills");
    expect(poseTalkOpen).toContain("mouth open mid-speech");
  });

  it("renders pose views as transparent cutouts and identity views on a studio background", () => {
    const front = renderCharacterReferencePrompt(input);
    const poseIdle = renderCharacterReferencePrompt({
      ...input,
      referenceType: "poseIdle",
    });

    // Identity views are only ever viewed on their own, so they keep the
    // opaque studio backdrop.
    expect(front).toContain("plain neutral studio background");
    expect(front).not.toContain("transparent background");

    // Poses are composited over a scene plate, so any backdrop at all —
    // including a contact shadow — would render as a visible box.
    expect(poseIdle).toContain("completely transparent background");
    expect(poseIdle).not.toContain("plain neutral studio background");
    expect(poseIdle).toContain("no cast shadow");
    expect(poseIdle).toContain(
      "Anything that is not the character itself must be fully transparent.",
    );
  });

  it("requires identical in-canvas placement across the pose set", () => {
    // Without this the character shifts between pose swaps and the sprite
    // visibly jitters at every mouth movement.
    const poseBlink = renderCharacterReferencePrompt({
      ...input,
      referenceType: "poseBlink",
    });
    expect(poseBlink).toContain("exact position within the canvas");
    expect(poseBlink).toContain("pixel-for-pixel identical");
  });
});
