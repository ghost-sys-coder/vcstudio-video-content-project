import {
  characterImportSchema,
  type CharacterFormValues,
} from "@/lib/schemas/character";

export const characterJsonSample: CharacterFormValues = {
  name: "Amara Okafor",
  description:
    "A calm, resourceful investigative journalist who follows financial stories across modern African cities.",
  visualIdentity:
    "Elegant editorial realism, composed posture, observant expression, and understated professional styling.",
  bodyProportions:
    "Adult woman of average height with a lean, athletic build and natural proportions.",
  faceDescription:
    "Oval face, defined cheekbones, almond-shaped dark brown eyes, straight nose, and a subtle dimple on the left cheek.",
  hairDescription:
    "Shoulder-length natural black twists, usually side-parted and neatly styled.",
  skinToneDescription: "Deep warm-brown skin with neutral golden undertones.",
  defaultOutfitDescription:
    "Forest-green tailored blazer, cream blouse, charcoal trousers, small gold stud earrings, and a black leather watch.",
  personalityNotes:
    "Patient, analytical, quietly confident, empathetic, and persistent without appearing confrontational.",
  continuityRules:
    "Keep facial structure, skin tone, side-parted twists, gold stud earrings, and black watch consistent. Preserve realistic adult proportions.",
  negativeConstraints:
    "No hairstyle changes, no facial tattoos, no exaggerated anatomy, no fantasy clothing, no extra jewelry, and no changes to apparent age.",
  status: "draft",
};

export type CharacterJsonParseResult =
  | { success: true; data: CharacterFormValues }
  | { success: false; error: string };

export function parseCharacterJson(input: string): CharacterJsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return { success: false, error: "Enter valid JSON before loading it." };
  }

  const parsed = characterImportSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return {
      success: false,
      error: `${location}${issue?.message ?? "Invalid character data."}`,
    };
  }

  return { success: true, data: parsed.data };
}
