import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingSkills } from "@/db/schema";

export async function listMarketingSkills(input: {
  workspaceId: string;
  enabledOnly?: boolean;
}) {
  const filters = [
    eq(marketingSkills.workspaceId, input.workspaceId),
    isNull(marketingSkills.deletedAt),
  ];
  if (input.enabledOnly) filters.push(eq(marketingSkills.isEnabled, true));
  return getDatabase()
    .select()
    .from(marketingSkills)
    .where(and(...filters))
    .orderBy(asc(marketingSkills.name))
    .limit(100);
}

export async function findMarketingSkill(input: {
  workspaceId: string;
  skillId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingSkills)
    .where(
      and(
        eq(marketingSkills.workspaceId, input.workspaceId),
        eq(marketingSkills.id, input.skillId),
        isNull(marketingSkills.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findMarketingSkillBySlug(input: {
  workspaceId: string;
  slug: string;
  includeDeleted?: boolean;
}) {
  const filters = [
    eq(marketingSkills.workspaceId, input.workspaceId),
    eq(marketingSkills.slug, input.slug),
  ];
  if (!input.includeDeleted) filters.push(isNull(marketingSkills.deletedAt));
  const [row] = await getDatabase()
    .select()
    .from(marketingSkills)
    .where(and(...filters))
    .orderBy(asc(marketingSkills.deletedAt))
    .limit(1);
  return row ?? null;
}

export async function findMarketingSkillForExecution(input: {
  workspaceId: string;
  skillId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingSkills)
    .where(
      and(
        eq(marketingSkills.workspaceId, input.workspaceId),
        eq(marketingSkills.id, input.skillId),
      ),
    )
    .limit(1);
  return row ?? null;
}
