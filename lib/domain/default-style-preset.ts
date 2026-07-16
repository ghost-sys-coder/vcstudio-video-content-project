export const DEFAULT_STYLE_PRESET = {
  slug: "stick-figure-financial-education",
  version: 1,
  name: "Stick Figure Financial Education",
  description:
    "Clean, high-contrast financial education illustrations with consistent stick-figure characters and restrained editorial color.",
  positivePrompt:
    "Minimal editorial stick-figure illustration, crisp dark linework, warm off-white background, restrained emerald and amber accents, clear visual hierarchy, expressive poses, polished educational explainer aesthetic, consistent character proportions, uncluttered composition.",
  negativePrompt:
    "Photorealism, 3D rendering, gradients, visual noise, illegible labels, captions, logos, watermarks, extra limbs, malformed hands, inconsistent character proportions, cluttered background, low contrast.",
  defaultAspectRatio: "16:9" as const,
} as const;
