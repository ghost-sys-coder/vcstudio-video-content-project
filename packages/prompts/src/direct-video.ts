/** Additive user-prompt envelope, pinned on every generation for reproducibility. */
export const DIRECT_VIDEO_PROMPT_VERSION = "direct-video-v1";
export function renderDirectVideoPrompt(input: {
  prompt: string;
  durationSeconds: number;
  roles: readonly string[];
}) {
  const references = input.roles
    .map((role, index) => `Image ${index + 1}: ${role.replaceAll("_", " ")}.`)
    .join("\n");
  return [
    input.prompt,
    `Create one continuous video, approximately ${input.durationSeconds} seconds long.`,
    references,
  ]
    .filter(Boolean)
    .join("\n\n");
}
