export type RenderAspectRatio = "16:9" | "9:16" | "1:1";

export interface RenderPreset {
  id: string;
  label: string;
  description: string;
  aspectRatio: RenderAspectRatio;
  width: number;
  height: number;
}

/**
 * The initially supported output formats. Each is a single fixed resolution;
 * frames per second is configured separately per project, not per preset.
 */
export const RENDER_PRESETS: readonly RenderPreset[] = [
  {
    id: "landscape_1080p",
    label: "Landscape 1080p",
    description: "1920 × 1080 — YouTube and horizontal players.",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
  },
  {
    id: "vertical_1080p",
    label: "Vertical 1080p",
    description: "1080 × 1920 — TikTok, Reels, and Shorts.",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
  },
  {
    id: "square_1080p",
    label: "Square 1080p",
    description: "1080 × 1080 — square feed posts.",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
  },
] as const;

export function getRenderPreset(presetId: string): RenderPreset | null {
  return RENDER_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

/**
 * The default preset that matches a project's configured aspect ratio, so the
 * render dimensions align with the images already generated for the project.
 */
export function defaultPresetForAspectRatio(
  aspectRatio: RenderAspectRatio,
): RenderPreset {
  const preset = RENDER_PRESETS.find(
    (candidate) => candidate.aspectRatio === aspectRatio,
  );
  // Every supported aspect ratio has exactly one preset in this release.
  if (!preset)
    throw new Error(`No render preset for aspect ratio ${aspectRatio}.`);
  return preset;
}

export function isSupportedRenderDimensions(input: {
  width: number;
  height: number;
}): boolean {
  return RENDER_PRESETS.some(
    (preset) => preset.width === input.width && preset.height === input.height,
  );
}
