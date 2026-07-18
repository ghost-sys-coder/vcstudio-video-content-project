export const DEFAULT_VOICE_PRESET = {
  slug: "default-narrator",
  name: "Default narrator",
  instructions:
    "Warm, clear, and steady narration suitable for educational videos. Natural pacing with confident delivery.",
} as const;

export function slugifyVoicePresetName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "voice-preset";
}
