export const MARKETING_SKILL_PROMPT_VERSION = "marketing-skill-v1";

export type MarketingSkillPromptInput = {
  skillLabel: string;
  instructions: string;
  inputs: Record<string, string | number>;
  brandContext: string;
};

export function renderMarketingSkillPrompt(
  input: MarketingSkillPromptInput,
): string {
  const values = Object.entries(input.inputs)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  return [
    `# Task\n${input.skillLabel}`,
    `# Instructions\n${input.instructions}`,
    `# Brand context\n${input.brandContext}`,
    `# User inputs\n${values}`,
    "# Output requirements\nReturn polished copy only. Do not invent prices, claims, certifications, results, or customer evidence. If required facts are missing, name the missing facts clearly.",
  ].join("\n\n");
}
