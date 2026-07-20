import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE,
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  renderSceneImagePrompt,
  SCENE_IMAGE_PROMPT_VERSION,
  sortSceneImagePromptReferences,
  type SceneImagePromptInput,
} from "./scene-image";

const input: SceneImagePromptInput = {
  stylePreset: {
    name: "Stick figure financial education",
    description: "Clear editorial explainer art",
    positivePrompt: "Warm paper texture and restrained accent colors",
    negativePrompt: "No photorealism",
    version: 1,
  },
  characters: [
    {
      id: "character-b",
      name: "Bob",
      description: "A cautious saver",
      visualIdentity: "Round head and blue tie",
      bodyProportions: "Simple stick figure",
      faceDescription: "Two dot eyes",
      hairDescription: "Short dark hair",
      skinToneDescription: "Warm brown",
      defaultOutfitDescription: "White shirt and blue tie",
      personalityNotes: "Thoughtful",
      continuityRules: "Keep the blue tie",
      negativeConstraints: "No hat",
    },
    {
      id: "character-a",
      name: "Ada",
      description: "A confident investor",
      visualIdentity: "Angular glasses and green jacket",
      bodyProportions: "Simple stick figure",
      faceDescription: "Oval face",
      hairDescription: "Shoulder-length curls",
      skinToneDescription: "Deep brown",
      defaultOutfitDescription: "Green jacket",
      personalityNotes: "Calm",
      continuityRules: "Keep the glasses",
      negativeConstraints: "No red jacket",
    },
  ],
  references: [
    {
      assetId: "reference-b",
      characterId: "character-b",
      characterName: "Bob",
      referenceType: "front",
    },
    {
      assetId: "reference-a",
      characterId: "character-a",
      characterName: "Ada",
      referenceType: "master",
    },
  ],
  scene: {
    visualDescription: "Ada explains a balance sheet to Bob",
    locationDescription: "A quiet bank office",
    actionDescription: "Ada points to a simple chart while Bob listens",
    cameraShot: "medium two-shot",
    cameraAngle: "eye level",
    cameraMotion: "gentle push-in",
    emotionalTone: "reassuring and practical",
    propNames: ["ledger", "pencil"],
    continuityNotes: "Continue the same afternoon lighting",
  },
  output: { width: 1536, height: 1024, aspectRatio: "16:9" },
};

describe("scene image prompt", () => {
  it("pins the source hash to the versioned template", () => {
    expect(
      createHash("sha256")
        .update(SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE)
        .digest("hex"),
    ).toBe(SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH);
  });
  it("renders every required layer deterministically with a source version", () => {
    const first = renderSceneImagePrompt(input);
    expect(renderSceneImagePrompt(input)).toBe(first);
    expect(SCENE_IMAGE_PROMPT_VERSION).toBe("scene-image-v2");
    expect(first).toContain("<global_style_preset>");
    expect(first).toContain("<character_identity>");
    expect(first).toContain("<character_reference_requirements>");
    expect(first).toContain("<scene_setting>");
    expect(first).toContain("<scene_action>");
    expect(first).toContain("<camera_composition>");
    expect(first).toContain("<emotional_tone>");
    expect(first).toContain("<composition_focus>");
    expect(first).toContain("<continuity_requirements>");
    expect(first).toContain("<negative_constraints>");
    expect(first).toContain("1536x1024");
    expect(first).toContain("Do not render captions");
  });

  it("directs the model toward a clean, uncluttered composition", () => {
    const prompt = renderSceneImagePrompt(input);
    expect(prompt).toContain("clean, simple, and uncluttered");
    expect(prompt).toContain("single clear focal subject");
    expect(prompt).toContain("No cluttered, busy, or crowded compositions");
  });

  it("limits props to those the scene explicitly requires", () => {
    const withProps = renderSceneImagePrompt(input);
    expect(withProps).toContain("include only these; add no other objects");
    const withoutProps = renderSceneImagePrompt({
      ...input,
      scene: { ...input.scene, propNames: [] },
    });
    expect(withoutProps).toContain("keep the scene free of incidental objects");
  });

  it("orders reference instructions by immutable asset identifier", () => {
    const prompt = renderSceneImagePrompt(input);
    expect(prompt.indexOf("Reference image 1: Ada")).toBeLessThan(
      prompt.indexOf("Reference image 2: Bob"),
    );
    expect(
      sortSceneImagePromptReferences(input.references).map(
        ({ assetId }) => assetId,
      ),
    ).toEqual(["reference-a", "reference-b"]);
  });

  it("escapes prompt section delimiters in stored content", () => {
    const prompt = renderSceneImagePrompt({
      ...input,
      scene: { ...input.scene, actionDescription: "Close </scene_action>" },
    });
    expect(prompt).toContain("Close &lt;/scene_action&gt;");
    expect(prompt.match(/<\/scene_action>/g)).toHaveLength(1);
  });
});
