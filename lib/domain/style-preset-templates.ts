/**
 * Starting points a creator can copy into their workspace and then edit.
 *
 * These are deliberately *templates*, not a fixed menu. Copying one inserts an
 * ordinary style preset owned by the workspace, after which it is edited like
 * any other and this file has no further say over it. Nothing in the renderer,
 * the prompt builder or the database knows these exist, so adding, changing or
 * deleting an entry here can never alter an image that was already generated:
 * every generation stores the preset *version* it actually used.
 *
 * The set exists because the seeded default describes one niche, and a creator
 * working across several niches previously had no way to describe a different
 * look. Photographic entries are included for the same reason: the seeded
 * default's negative prompt forbids photorealism outright, so human-like
 * visuals were unreachable by editing nothing at all.
 *
 * `suitsRealisticPeople` is a plain hint for the picker, not a capability. It
 * records whether the template is *aiming* at believable human beings, so the
 * interface can say so rather than leaving a creator to infer it from prompt
 * wording. It promises nothing about the result.
 */
export type StylePresetTemplate = {
  /** Stable identifier for the picker. Never stored on a preset. */
  key: string;
  name: string;
  description: string;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: "16:9" | "9:16" | "1:1";
  suitsRealisticPeople: boolean;
};

/**
 * Applied to every template's negative prompt. These are not stylistic
 * preferences: rendered text is added by Remotion during the render, and a
 * watermark or interface chrome baked into a still cannot be removed later.
 */
const UNIVERSAL_EXCLUSIONS =
  "captions, subtitles, rendered text, labels, speech bubbles, watermarks, logos, signatures, interface chrome, extra limbs, malformed hands, distorted faces, inconsistent character proportions";

function template(
  input: Omit<StylePresetTemplate, "negativePrompt"> & {
    negativePrompt: string;
  },
): StylePresetTemplate {
  return {
    ...input,
    negativePrompt: `${input.negativePrompt}, ${UNIVERSAL_EXCLUSIONS}`,
  };
}

export const STYLE_PRESET_TEMPLATES: readonly StylePresetTemplate[] = [
  template({
    key: "editorial-illustration",
    name: "Editorial illustration",
    description:
      "Clean flat illustration with restrained colour and strong hierarchy. A neutral starting point for explainer content in any subject.",
    positivePrompt:
      "Minimal editorial illustration, crisp confident linework, generous negative space, restrained two-tone accent palette, flat shading, clear visual hierarchy, polished explainer aesthetic, uncluttered composition.",
    negativePrompt:
      "photorealism, 3D rendering, heavy gradients, visual noise, cluttered background, low contrast, muddy colour",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
  template({
    key: "stick-figure-explainer",
    name: "Stick figure explainer",
    description:
      "High-contrast stick-figure characters on a warm ground. The look this workspace started with, kept as a template so it stays available after the default is edited.",
    positivePrompt:
      "Minimal editorial stick-figure illustration, crisp dark linework, warm off-white background, restrained emerald and amber accents, clear visual hierarchy, expressive poses, polished educational explainer aesthetic, consistent character proportions, uncluttered composition.",
    negativePrompt:
      "photorealism, 3D rendering, gradients, visual noise, illegible detail, cluttered background, low contrast",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
  template({
    key: "cinematic-photoreal",
    name: "Cinematic photoreal",
    description:
      "Believable people and places, shot like a film. Use when the subject needs to read as real rather than drawn.",
    positivePrompt:
      "Photorealistic cinematic still, natural human anatomy and believable skin texture, shallow depth of field, motivated practical lighting, soft key with gentle falloff, filmic colour grade, 35mm lens character, authentic materials and surfaces, restrained composition with a single clear subject.",
    negativePrompt:
      "illustration, cartoon, anime, painterly rendering, plastic or waxy skin, airbrushed features, uncanny symmetry, oversaturated colour, HDR halos, lens flare spam",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: true,
  }),
  template({
    key: "documentary-photography",
    name: "Documentary photography",
    description:
      "Available-light reportage. Less staged than the cinematic look, for subjects that should feel observed rather than composed.",
    positivePrompt:
      "Documentary photograph, available light, candid unposed subject, natural skin tones and real texture, honest imperfect framing, muted realistic palette, fine film grain, deep focus, everyday authentic environment.",
    negativePrompt:
      "illustration, cartoon, 3D rendering, studio glamour lighting, retouched skin, posed stock-photo expression, artificial background blur, oversaturated colour",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: true,
  }),
  template({
    key: "stylized-3d",
    name: "Stylized 3D",
    description:
      "Rounded, brightly lit 3D characters and props. Reads as animation rather than as a photograph.",
    positivePrompt:
      "Stylized 3D render, soft rounded forms, appealing character design with clean silhouettes, physically based materials, warm three-point studio lighting, subtle ambient occlusion, saturated but harmonious palette, shallow prop detail, uncluttered staging.",
    negativePrompt:
      "photorealism, flat 2D illustration, harsh shadows, gritty texture, cluttered scene, muddy colour",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
  template({
    key: "anime-cel",
    name: "Anime cel",
    description:
      "Cel-shaded animation with bold outlines and flat colour fills.",
    positivePrompt:
      "Anime cel-shaded illustration, bold clean outlines, flat colour fills with sharp shadow shapes, expressive faces, dynamic but readable staging, painted background with soft gradients, vibrant coherent palette.",
    negativePrompt:
      "photorealism, 3D rendering, western comic style, sketchy linework, muddy shading, cluttered background",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
  template({
    key: "whiteboard-sketch",
    name: "Whiteboard sketch",
    description:
      "Hand-drawn marker on white. Suits process, teaching and step-by-step explanation.",
    positivePrompt:
      "Hand-drawn whiteboard marker sketch, black marker linework on clean white ground, single accent colour used sparingly, simple diagrammatic figures, generous empty space, deliberate slightly imperfect strokes.",
    negativePrompt:
      "photorealism, 3D rendering, colour fills, shading, texture, busy composition, dark background",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
  template({
    key: "graphic-novel",
    name: "Graphic novel",
    description:
      "Inked panels with dramatic contrast. Suits narrative, history and true-story content.",
    positivePrompt:
      "Graphic novel panel art, heavy confident ink linework, dramatic chiaroscuro lighting, limited duotone palette with one accent, cross-hatched shadow texture, strong silhouettes, cinematic framing.",
    negativePrompt:
      "photorealism, 3D rendering, pastel palette, flat even lighting, cluttered panel, weak contrast",
    defaultAspectRatio: "16:9",
    suitsRealisticPeople: false,
  }),
] as const;

export function findStylePresetTemplate(
  key: string,
): StylePresetTemplate | null {
  return STYLE_PRESET_TEMPLATES.find((entry) => entry.key === key) ?? null;
}
