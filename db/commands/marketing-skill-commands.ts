import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingSkills } from "@/db/schema";
import type { MarketingSkillMutationInput } from "@/lib/schemas/marketing-skill";

export async function saveMarketingSkill(input: {
  workspaceId: string;
  createdByUserId: string;
  skill: MarketingSkillMutationInput;
}) {
  const values = {
    slug: input.skill.slug,
    name: input.skill.name,
    description: input.skill.description,
    instructions: input.skill.instructions,
    baseSkillKey: input.skill.baseSkillKey,
    inputFields: input.skill.inputFields,
    defaultPlatform: input.skill.defaultPlatform,
    defaultContentKind: input.skill.defaultContentKind,
    isEnabled: input.skill.isEnabled,
    updatedAt: new Date(),
  } as const;
  if (input.skill.skillId) {
    const [updated] = await getDatabase()
      .update(marketingSkills)
      .set({ ...values, version: sql`${marketingSkills.version} + 1` })
      .where(
        and(
          eq(marketingSkills.id, input.skill.skillId),
          eq(marketingSkills.workspaceId, input.workspaceId),
          isNull(marketingSkills.deletedAt),
        ),
      )
      .returning();
    if (!updated) throw new Error("MARKETING_SKILL_NOT_FOUND");
    return updated;
  }
  const [created] = await getDatabase()
    .insert(marketingSkills)
    .values({
      ...values,
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  if (!created) throw new Error("MARKETING_SKILL_NOT_CREATED");
  return created;
}

export async function setMarketingSkillEnabled(input: {
  workspaceId: string;
  skillId: string;
  enabled: boolean;
}) {
  const [updated] = await getDatabase()
    .update(marketingSkills)
    .set({ isEnabled: input.enabled, updatedAt: new Date() })
    .where(
      and(
        eq(marketingSkills.id, input.skillId),
        eq(marketingSkills.workspaceId, input.workspaceId),
        isNull(marketingSkills.deletedAt),
      ),
    )
    .returning({ id: marketingSkills.id });
  if (!updated) throw new Error("MARKETING_SKILL_NOT_FOUND");
}

export async function softDeleteMarketingSkill(input: {
  workspaceId: string;
  skillId: string;
}) {
  const [deleted] = await getDatabase()
    .update(marketingSkills)
    .set({ deletedAt: new Date(), isEnabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(marketingSkills.id, input.skillId),
        eq(marketingSkills.workspaceId, input.workspaceId),
        isNull(marketingSkills.deletedAt),
      ),
    )
    .returning({ id: marketingSkills.id, slug: marketingSkills.slug });
  if (!deleted) throw new Error("MARKETING_SKILL_NOT_FOUND");
  return deleted;
}
