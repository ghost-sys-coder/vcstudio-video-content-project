import { parseEmphasisList } from "@/lib/audio/voice-direction";
import { createSceneSchema, updateSceneSchema } from "@/lib/schemas/scene";

function readSceneFields(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const names = (value: unknown) =>
    String(value ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  return {
    ...raw,
    characterNames: names(raw.characterNames),
    propNames: names(raw.propNames),
    voiceEmphasis: parseEmphasisList(String(raw.voiceEmphasis ?? "")),
    estimatedDurationMilliseconds: Number(raw.estimatedDurationMilliseconds),
  };
}

export function parseSceneEditorInput(formData: FormData) {
  return updateSceneSchema.safeParse(readSceneFields(formData));
}

export function parseNewSceneInput(formData: FormData) {
  return createSceneSchema.safeParse(readSceneFields(formData));
}
