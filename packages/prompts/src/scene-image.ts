export const SCENE_IMAGE_PROMPT_VERSION = "scene-image-v2";
export const SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH =
  "d1d0224d441c3ceaa941ca8da724cce56ebd7f2de4e8ea795d567f1cbd459fea";

export const SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE = `VCStudio scene image prompt
Layers: global style, character identity, character reference requirements,
scene setting, scene action, camera composition, emotional tone, composition
focus (clean, uncluttered, single clear subject), continuity, negative
constraints, output dimensions, aspect ratio, and text exclusion.`;

export type SceneImagePromptCharacter = {
  id: string;
  name: string;
  description: string;
  visualIdentity: string;
  bodyProportions: string;
  faceDescription: string;
  hairDescription: string;
  skinToneDescription: string;
  defaultOutfitDescription: string;
  personalityNotes: string;
  continuityRules: string;
  negativeConstraints: string;
};

export type SceneImagePromptReference = {
  assetId: string;
  characterId: string;
  characterName: string;
  referenceType: string;
};

export type SceneImagePromptInput = {
  stylePreset: {
    name: string;
    description: string;
    positivePrompt: string;
    negativePrompt: string;
    version: number;
  };
  characters: SceneImagePromptCharacter[];
  references: SceneImagePromptReference[];
  scene: {
    visualDescription: string;
    locationDescription: string;
    actionDescription: string;
    cameraShot: string;
    cameraAngle: string;
    cameraMotion: string;
    emotionalTone: string;
    propNames: string[];
    continuityNotes: string;
  };
  output: {
    width: number;
    height: number;
    aspectRatio: string;
  };
};

function escapePromptValue(value: string): string {
  return value
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderField(label: string, value: string): string | null {
  const escapedValue = escapePromptValue(value);
  return escapedValue.length > 0 ? `- ${label}: ${escapedValue}` : null;
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line !== null).join("\n");
}

export function sortSceneImagePromptReferences(
  references: SceneImagePromptReference[],
): SceneImagePromptReference[] {
  return [...references].sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  );
}

function renderCharacters(characters: SceneImagePromptCharacter[]): string {
  if (characters.length === 0)
    return "No recurring character identity is assigned to this scene.";

  return [...characters]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((character, index) => {
      const details = compactLines([
        renderField("Name", character.name),
        renderField("Role and description", character.description),
        renderField("Canonical visual identity", character.visualIdentity),
        renderField("Body proportions", character.bodyProportions),
        renderField("Face", character.faceDescription),
        renderField("Hair", character.hairDescription),
        renderField("Skin tone", character.skinToneDescription),
        renderField("Default outfit", character.defaultOutfitDescription),
        renderField("Personality cues", character.personalityNotes),
        renderField("Identity continuity rules", character.continuityRules),
      ]);
      return `Character ${index + 1}\n${details}`;
    })
    .join("\n\n");
}

function renderReferences(references: SceneImagePromptReference[]): string {
  const orderedReferences = sortSceneImagePromptReferences(references);
  if (orderedReferences.length === 0)
    return "No reference images are attached. Follow the canonical character identity descriptions exactly.";

  const referenceLines = orderedReferences.map(
    (reference, index) =>
      `- Reference image ${index + 1}: ${escapePromptValue(reference.characterName)} - ${escapePromptValue(reference.referenceType)} view. Preserve this character's identity, proportions, face, and defining visual features.`,
  );
  return [
    ...referenceLines,
    "Treat every reference as identity guidance, not as a request to copy its background, framing, pose, or lighting unless the scene instructions require it.",
  ].join("\n");
}

function renderCharacterNegativeConstraints(
  characters: SceneImagePromptCharacter[],
): string[] {
  return [...characters]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((character) => {
      const constraint = escapePromptValue(character.negativeConstraints);
      const name = escapePromptValue(character.name);
      return constraint.length > 0 ? [`- ${name}: ${constraint}`] : [];
    });
}

export function renderSceneImagePrompt(input: SceneImagePromptInput): string {
  const propNames = [...input.scene.propNames]
    .map(escapePromptValue)
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right));
  const characterNegativeConstraints = renderCharacterNegativeConstraints(
    input.characters,
  );

  return `${SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE}
Template version: ${SCENE_IMAGE_PROMPT_VERSION}

<global_style_preset>
- Name: ${escapePromptValue(input.stylePreset.name)}
- Version: ${input.stylePreset.version}
${compactLines([
  renderField("Description", input.stylePreset.description),
  renderField("Positive style direction", input.stylePreset.positivePrompt),
])}
</global_style_preset>

<character_identity>
${renderCharacters(input.characters)}
</character_identity>

<character_reference_requirements>
${renderReferences(input.references)}
</character_reference_requirements>

<scene_setting>
${compactLines([
  renderField("Visual objective", input.scene.visualDescription),
  renderField("Location and environment", input.scene.locationDescription),
  propNames.length > 0
    ? `- Required props (include only these; add no other objects): ${propNames.join(", ")}`
    : "- No specific props are required; keep the scene free of incidental objects.",
])}
</scene_setting>

<scene_action>
${compactLines([renderField("Action", input.scene.actionDescription)])}
</scene_action>

<camera_composition>
${compactLines([
  renderField("Shot", input.scene.cameraShot),
  renderField("Angle", input.scene.cameraAngle),
  renderField("Motion implication", input.scene.cameraMotion),
])}
</camera_composition>

<emotional_tone>
${escapePromptValue(input.scene.emotionalTone)}
</emotional_tone>

<composition_focus>
- Keep the composition clean, simple, and uncluttered. Clarity beats detail.
- Show a single clear focal subject: the character(s) and action described above must dominate the frame and read instantly at a glance.
- Use a simple, minimal background that supports the subject; include only environment detail essential to the location, never busy or crowded scenery.
- Leave generous negative space and breathing room around the subject; do not fill the frame edge to edge with objects.
- Do not invent extra props, background characters, crowds, signage, decoration, or incidental clutter that the scene did not call for.
- Prefer one strong idea per image over many competing elements.
</composition_focus>

<continuity_requirements>
${escapePromptValue(input.scene.continuityNotes) || "Maintain visual continuity with adjacent scenes and all canonical character rules."}
</continuity_requirements>

<negative_constraints>
${compactLines([
  renderField("Style exclusions", input.stylePreset.negativePrompt),
  ...characterNegativeConstraints,
  "- No cluttered, busy, or crowded compositions; no visual noise, no densely packed background detail, no extra background characters or crowds, and no unrequested props or decoration.",
  "- No duplicate characters, extra limbs, malformed hands, distorted faces, conflicting light directions, accidental borders, watermarks, logos, or interface chrome.",
])}
</negative_constraints>

<output_requirements>
- Produce exactly one complete image at ${input.output.width}x${input.output.height} pixels.
- Compose for ${escapePromptValue(input.output.aspectRatio)} aspect ratio with safe room for later Remotion crop or fit.
- Do not render captions, labels, numbers, speech bubbles, watermarks, logos, signs, UI text, or any other visible text. Text will be added during video rendering.
- Keep all critical subjects and actions inside the safe composition area.
</output_requirements>`;
}
