import type { ScriptGenerationPlatform } from "./script-generation";

export const THUMBNAIL_PROMPT_VERSION = "thumbnail-v1";

export const THUMBNAIL_PROMPT_TEMPLATE_KEY = "thumbnail";

export const THUMBNAIL_PROMPT_TEMPLATE_SOURCE = `VCStudio publish thumbnail prompt
Layers: platform framing, subject and emotion, composition heuristics, colour and
contrast, content grounding, text mode (baked headline or text-free), negative
constraints, and output dimensions.`;

// SHA-256 of THUMBNAIL_PROMPT_TEMPLATE_SOURCE. Any change to the template's
// meaning must bump the version and this hash, or generation fails
// `prompt_template_mismatch` (reproducibility guard, mirroring scene images).
export const THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH =
  "4058fbb108a90e0ba4f7b5742140c4f7e70621545059ee31fd73aeda499fdda8";

export type ThumbnailTextMode = "baked" | "clean";

export type ThumbnailPromptInput = {
  platform: ScriptGenerationPlatform;
  topic: string;
  targetAudience: string;
  tone: string;
  hookAngle: string;
  title: string | null;
  scriptExcerpt: string | null;
  textMode: ThumbnailTextMode;
  headlineText: string | null;
  output: { width: number; height: number };
};

// Per-platform framing. These describe how the thumbnail is actually consumed —
// a YouTube card viewed at ~210px wide reads very differently from a full-bleed
// TikTok cover behind UI chrome — which is what drives the composition rules.
const platformFraming: Record<
  ScriptGenerationPlatform,
  { label: string; framing: string; safeArea: string }
> = {
  youtube: {
    label: "YouTube",
    framing:
      "A 16:9 YouTube video thumbnail that must stay legible when shrunk to roughly 210 pixels wide in a crowded browse feed.",
    safeArea:
      "Keep the subject and any headline clear of the bottom-right corner, where the duration badge sits.",
  },
  tiktok: {
    label: "TikTok",
    framing:
      "A vertical 9:16 TikTok cover image that must read instantly while a viewer is scrolling at speed.",
    safeArea:
      "Keep the subject and any headline within the middle 60 percent vertically — the top and bottom are covered by app UI, captions, and the account handle.",
  },
  facebook: {
    label: "Facebook",
    framing:
      "A Facebook video thumbnail seen in a mixed feed, usually with the sound off, next to text posts and photos.",
    safeArea:
      "Keep the composition centred and uncluttered so it survives feed cropping.",
  },
  instagram: {
    label: "Instagram",
    framing:
      "A vertical Instagram Reels cover that also needs to look deliberate as a small square tile in a profile grid.",
    safeArea:
      "Keep the subject inside the central square region so the profile-grid crop does not cut it off.",
  },
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

function textModeBlock(
  textMode: ThumbnailTextMode,
  headlineText: string | null,
): string {
  if (textMode === "clean")
    return [
      "Render the image completely free of text. No headline, no letters, no numbers, no logos, no watermarks, no signage, no captions.",
      "Leave deliberate negative space on one side of the frame so a headline can be overlaid later without covering the subject's face.",
    ].join("\n");

  const headline = escapePromptValue(headlineText ?? "");
  return [
    `Render exactly one short headline baked into the image, reading precisely: "${headline}"`,
    "Set it in a heavy, bold, sans-serif typeface with a strong outline or drop shadow so it separates from the background.",
    "Place the headline so it never covers the subject's eyes or mouth. Keep it to a single line, or two at most.",
    "Do not add any other text, letters, numbers, logos, watermarks, or signage anywhere in the frame.",
  ].join("\n");
}

function contentBlock(input: ThumbnailPromptInput): string {
  const excerpt = input.scriptExcerpt?.trim() ?? "";
  const grounding = compactLines([
    renderField("Topic", input.topic),
    renderField("Intended audience", input.targetAudience),
    renderField("Tone", input.tone),
    renderField("Hook angle", input.hookAngle),
    input.title === null ? null : renderField("Working title", input.title),
  ]);
  const lines = [
    grounding.length > 0
      ? grounding
      : "- (no brief details supplied; keep the image generic but striking)",
  ];
  if (excerpt.length > 0)
    lines.push(
      "The image must be honest about the actual content below — do not depict anything the video does not deliver.",
      `Content excerpt:\n"""\n${excerpt.length > 1200 ? `${excerpt.slice(0, 1200)}…` : excerpt}\n"""`,
    );
  return lines.join("\n");
}

/**
 * Deterministic, XML-tagged prompt that turns a project's brief (and optionally
 * its approved script and chosen title) into a single high-click-through
 * thumbnail. Pure — the same input always yields the same string, which is what
 * the source hash above guards.
 *
 * The composition rules encode widely observed click-through patterns (one
 * expressive face, strong readable emotion, high contrast, rule-of-thirds
 * placement, minimal clutter, directional gaze). They are strong starting
 * points for A/B testing, not a guarantee of performance.
 */
export function renderThumbnailPrompt(input: ThumbnailPromptInput): string {
  const platform = platformFraming[input.platform];

  return [
    "<platform_framing>",
    platform.framing,
    platform.safeArea,
    "</platform_framing>",
    "<subject_and_emotion>",
    "Feature a single human subject as the focal point, framed from the chest or shoulders up so the face is large in the frame.",
    "The face must carry one strong, unambiguous emotion that matches the tone below — readable at a glance, not a neutral expression.",
    "Point the subject's gaze either straight at the viewer or toward the most important element in the frame.",
    "</subject_and_emotion>",
    "<composition>",
    "Place the focal point on a rule-of-thirds intersection rather than dead centre.",
    "Keep the composition simple: one clear subject, at most one supporting object, and an uncluttered background.",
    "Separate the subject from the background with depth of field, a rim light, or a contrasting colour field.",
    "</composition>",
    "<colour_and_contrast>",
    "Use a high-contrast, saturated palette with a clear dominant colour so the image stands out against a white or dark feed background.",
    "Light the subject's face brightly and evenly; avoid muddy midtones and avoid low-contrast pastel schemes.",
    "</colour_and_contrast>",
    "<content_grounding>",
    contentBlock(input),
    "</content_grounding>",
    "<text_mode>",
    textModeBlock(input.textMode, input.headlineText),
    "</text_mode>",
    "<negative_constraints>",
    "- No borders, frames, letterboxing, collages, split screens, or multi-panel layouts.",
    "- No extra people beyond the single subject, no crowds, no small background figures.",
    "- No distorted hands, extra fingers, or malformed facial features.",
    "- No platform logos, play buttons, progress bars, or fake user-interface chrome.",
    "- Nothing misleading, shocking, or sexualised; keep the image honest to the content.",
    "</negative_constraints>",
    "<output_requirements>",
    `- Output dimensions: ${input.output.width}x${input.output.height} pixels.`,
    `- Target platform: ${platform.label}.`,
    "- Photographic realism with crisp focus on the subject's face.",
    "</output_requirements>",
  ].join("\n");
}
