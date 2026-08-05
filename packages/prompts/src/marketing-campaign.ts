export const MARKETING_CAMPAIGN_PROMPT_VERSION = "marketing-campaign-v1";

type CampaignPromptInput = {
  name: string;
  objective: string;
  platform: string;
  keyMessage: string;
  audience: string;
  brandContext: string;
};

function facts(input: CampaignPromptInput) {
  return `Campaign: ${input.name}\nObjective: ${input.objective}\nPlatform: ${input.platform}\nKey message: ${input.keyMessage}\nAudience: ${input.audience}\n\nBrand context:\n${input.brandContext}`;
}

export function renderOrganicCampaignPrompt(input: CampaignPromptInput) {
  return `Create an organic campaign brief with a measurable hypothesis, content angles, cadence, and success indicators. Do not invent business facts.\n\n${facts(input)}`;
}

export function renderPaidCampaignPrompt(input: CampaignPromptInput) {
  return `Create a paid campaign brief and three clearly differentiated ad-copy angles. Respect platform advertising policies and placement character limits. Do not make misleading claims or invent business facts.\n\n${facts(input)}`;
}
