export const CHARACTER_REFERENCE_PROMPT_VERSION = "character-reference-v3";

// SHA-256 of CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE. Any change to the
// template's meaning must bump the version and this hash, or generation fails
// `prompt_template_mismatch` (reproducibility guard, mirroring scene images).
// No migration is needed for the version bump itself — `ensureCharacterReferencePromptTemplate`
// inserts each new (templateKey, version) row at request time.
export const CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH =
  "aca0d246ff9d7bfa2226828a0ed2b5f842fd158a82f9ad5f57387340ec8e7a45";

export const CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE = `VCStudio character reference portrait prompt
Layers: global portrait framing, character identity, face, hair, skin tone,
body proportions, default outfit, requested reference view, negative
constraints, output dimensions, and text exclusion. Identity views render on a
plain neutral studio background. Animation pose views (poseIdle, poseTalkOpen,
poseTalkClosed, poseBlink) instead render as fully cut-out sprites on a
transparent background, and additionally require pixel-for-pixel matched camera
distance, framing, scale, crop, and character placement within the canvas across
the set, since they are swapped during playback and composited over a separate
scene background rather than shown individually.`;

export type CharacterReferenceView =
  | "master"
  | "front"
  | "threeQuarter"
  | "side"
  | "fullBody"
  | "poseIdle"
  | "poseTalkOpen"
  | "poseTalkClosed"
  | "poseBlink";

// The four pose kinds must line up as a matched set (same camera distance,
// framing, scale, crop) since they're swapped frame-to-frame during
// animation playback — unlike the five identity views above, which are shown
// individually and only need consistent *identity*, not consistent *scale*.
const animationPoseViews = new Set<CharacterReferenceView>([
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
]);

export type CharacterReferencePromptCharacter = {
  name: string;
  description: string;
  visualIdentity: string;
  bodyProportions: string;
  faceDescription: string;
  hairDescription: string;
  skinToneDescription: string;
  defaultOutfitDescription: string;
  negativeConstraints: string;
};

export type CharacterReferencePromptInput = {
  character: CharacterReferencePromptCharacter;
  referenceType: CharacterReferenceView;
  output: {
    width: number;
    height: number;
  };
};

const viewFraming: Record<CharacterReferenceView, string> = {
  master:
    "A clean, front-facing canonical character identity reference portrait from the chest up.",
  front:
    "A front-facing character portrait, centered, in a relaxed neutral pose facing the camera.",
  threeQuarter:
    "A three-quarter (approximately 45 degree) view character portrait, body turned slightly while the face reads clearly.",
  side: "A side profile (approximately 90 degree) view character portrait.",
  fullBody:
    "A full-body, head-to-toe, front-facing character portrait showing the complete outfit and proportions.",
  poseIdle:
    "A relaxed neutral idle pose for this character: standing or sitting comfortably, arms at ease, mouth gently closed, eyes open, facing the camera.",
  poseTalkOpen:
    "The exact same pose, camera distance, and framing as this character's idle pose, but with the mouth open mid-speech as if actively talking.",
  poseTalkClosed:
    "The exact same pose, camera distance, and framing as this character's idle pose, with the mouth gently closed as if between words while talking.",
  poseBlink:
    "The exact same pose, camera distance, and framing as this character's idle pose, with the eyes closed as if mid-blink.",
};

function escapePromptValue(value: string): string {
  return value
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderField(label: string, value: string): string | null {
  const escaped = escapePromptValue(value);
  return escaped.length > 0 ? `- ${label}: ${escaped}` : null;
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line !== null).join("\n");
}

/**
 * Deterministic, XML-tagged prompt that turns a character's structured identity
 * into a single canonical reference portrait for the requested view. Pure — the
 * same input always yields the same string (reproducibility is enforced by the
 * source hash above).
 */
export function renderCharacterReferencePrompt(
  input: CharacterReferencePromptInput,
): string {
  const identity = compactLines([
    renderField("Name", input.character.name),
    renderField("Role and description", input.character.description),
    renderField("Canonical visual identity", input.character.visualIdentity),
    renderField("Body proportions", input.character.bodyProportions),
    renderField("Face", input.character.faceDescription),
    renderField("Hair", input.character.hairDescription),
    renderField("Skin tone", input.character.skinToneDescription),
    renderField("Default outfit", input.character.defaultOutfitDescription),
  ]);
  const negative = escapePromptValue(input.character.negativeConstraints);
  const isAnimationPose = animationPoseViews.has(input.referenceType);

  return [
    "<global_portrait_framing>",
    viewFraming[input.referenceType],
    isAnimationPose
      ? "Render exactly one character, centered, fully cut out on a completely transparent background with soft, even lighting. There must be no backdrop, no floor, no ground plane, no cast shadow on any surface, and no vignette — only the character's own pixels are opaque. This sprite is composited over a separate scene background during video rendering."
      : "Render exactly one character, centered, on a plain neutral studio background with soft, even lighting. This is a reusable identity reference, not a scene.",
    isAnimationPose
      ? "This portrait is one of a matched set of pose stills for this character (idle, talking mouth-open, talking mouth-closed, blinking) that will be swapped frame to frame during animation — keep camera distance, framing, scale, crop, and the character's exact position within the canvas pixel-for-pixel identical across the set, as if the camera never moved between shots and the character never shifted. Only the detail named for this specific pose may differ; everything else must match."
      : null,
    "</global_portrait_framing>",
    "<character_identity>",
    identity.length > 0
      ? identity
      : "- Name: (unnamed character with no additional identity details)",
    "</character_identity>",
    "<reference_view>",
    `- Requested view: ${input.referenceType}`,
    "Keep the character's identity, proportions, face, hair, skin tone, and outfit consistent so this portrait can anchor future scene generations.",
    "</reference_view>",
    "<negative_constraints>",
    negative.length > 0
      ? `- ${negative}`
      : "- (no character-specific negative constraints)",
    "- Do not include multiple characters, props, scenery, borders, watermarks, or any text.",
    isAnimationPose
      ? "- Do not draw any background, backdrop, wall, floor, ground plane, contact shadow, or environment behind or beneath the character. Anything that is not the character itself must be fully transparent."
      : null,
    "</negative_constraints>",
    "<output_requirements>",
    `- Output dimensions: ${input.output.width}x${input.output.height} pixels.`,
    "- No text, letters, numbers, logos, or watermarks anywhere in the image.",
    "</output_requirements>",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
