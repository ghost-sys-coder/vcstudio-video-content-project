import "server-only";
import {
  findMarketingSkillBySlug,
  findMarketingSkillForExecution,
  listMarketingSkills,
} from "@/db/repositories/marketing-skills.repository";
import { compileUserSkill } from "@/lib/marketing/skills/compile-user-skill";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import { MARKETING_SKILL_REGISTRY } from "@/lib/marketing/skills/skill-registry";

export async function loadMarketingSkillDefinitions(input: {
  workspaceId: string;
}): Promise<MarketingSkillDefinition[]> {
  const rows = await listMarketingSkills({
    workspaceId: input.workspaceId,
    enabledOnly: true,
  });
  return [
    ...Object.values(MARKETING_SKILL_REGISTRY),
    ...rows.map(compileUserSkill),
  ];
}

export async function resolveMarketingSkillDefinition(input: {
  workspaceId: string;
  skillKey: string;
  userSkillId?: string;
}): Promise<MarketingSkillDefinition | null> {
  const builtIn =
    MARKETING_SKILL_REGISTRY[
      input.skillKey as keyof typeof MARKETING_SKILL_REGISTRY
    ];
  if (builtIn) return builtIn;
  const row = input.userSkillId
    ? await findMarketingSkillForExecution({
        workspaceId: input.workspaceId,
        skillId: input.userSkillId,
      })
    : await findMarketingSkillBySlug({
        workspaceId: input.workspaceId,
        slug: input.skillKey,
        includeDeleted: true,
      });
  return row ? compileUserSkill(row) : null;
}
