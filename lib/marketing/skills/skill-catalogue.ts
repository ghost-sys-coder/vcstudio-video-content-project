import "server-only";
import type { WorkspaceRole } from "@/db/schema";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { can } from "@/lib/policies/workspace-policy";
import { loadMarketingSkillDefinitions } from "@/lib/marketing/skills/load-skill-definitions";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";

export async function loadMarketingSkillCatalogue(input: {
  workspaceId: string;
  role: WorkspaceRole;
  hasBrandProfile: boolean;
}): Promise<MarketingSkillCatalogueItem[]> {
  const budget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const definitions = await loadMarketingSkillDefinitions({
    workspaceId: input.workspaceId,
  });
  return definitions
    .filter((skill) => can(input.role, skill.capability))
    .filter((skill) => !skill.requiresBrandProfile || input.hasBrandProfile)
    .map((skill) => ({
      key: skill.key,
      label: skill.label,
      description: skill.description,
      group: skill.group,
      inputFields: skill.inputFields,
      estimatedCostRangeCents: skill.estimatedCostRangeCents,
      requiresConfirmation:
        skill.estimatedCostRangeCents[1] >=
        budget.manualConfirmationThresholdCents,
    }));
}
