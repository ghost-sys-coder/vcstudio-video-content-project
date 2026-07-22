import type { ProjectAspectRatio } from "@/db/schema";

export interface OutputVariantDefinition {
  aspectRatio: ProjectAspectRatio;
  name: string;
  width: number;
  height: number;
}

export const OUTPUT_VARIANT_DEFINITIONS: readonly OutputVariantDefinition[] = [
  {
    aspectRatio: "16:9",
    name: "Landscape",
    width: 1920,
    height: 1080,
  },
  {
    aspectRatio: "9:16",
    name: "Vertical",
    width: 1080,
    height: 1920,
  },
  {
    aspectRatio: "1:1",
    name: "Square",
    width: 1080,
    height: 1080,
  },
] as const;

export function getOutputVariantDefinition(
  aspectRatio: ProjectAspectRatio,
): OutputVariantDefinition {
  const definition = OUTPUT_VARIANT_DEFINITIONS.find(
    (candidate) => candidate.aspectRatio === aspectRatio,
  );
  if (!definition)
    throw new Error(`Unsupported output aspect ratio: ${aspectRatio}`);
  return definition;
}
