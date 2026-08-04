import "server-only";
import type { WorkspaceRole } from "@/db/schema";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { can } from "@/lib/policies/workspace-policy";
import { MARKETING_SKILL_REGISTRY } from "@/lib/marketing/skills/skill-registry";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";

export async function loadMarketingSkillCatalogue(input: {
  workspaceId: string;
  role: WorkspaceRole;
  hasBrandProfile: boolean;
}): Promise<MarketingSkillCatalogueItem[]> {
  const budget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  return Object.values(MARKETING_SKILL_REGISTRY)
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
