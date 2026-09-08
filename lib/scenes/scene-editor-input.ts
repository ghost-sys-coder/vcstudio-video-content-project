import { updateSceneSchema } from "@/lib/schemas/scene";

export function parseSceneEditorInput(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const names = (value: unknown) =>
    String(value ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  return updateSceneSchema.safeParse({
    ...raw,
    characterNames: names(raw.characterNames),
    propNames: names(raw.propNames),
    estimatedDurationMilliseconds: Number(raw.estimatedDurationMilliseconds),
  });
}
