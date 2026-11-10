/** Preserve the user's complete prompt without silently adding a scene or style. */
export const STANDALONE_IMAGE_PROMPT_VERSION = "standalone-image-v1";
export function renderStandaloneImagePrompt(prompt: string): string {
  return prompt.trim();
}
