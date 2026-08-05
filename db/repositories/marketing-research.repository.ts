import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingCompetitors, marketingResearchSnapshots } from "@/db/schema";

export async function listActiveMarketingCompetitors(input: {
  workspaceId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingCompetitors)
    .where(
      and(
        eq(marketingCompetitors.workspaceId, input.workspaceId),
        eq(marketingCompetitors.isActive, true),
        isNull(marketingCompetitors.deletedAt),
      ),
    )
    .orderBy(desc(marketingCompetitors.priority), marketingCompetitors.name);
}

export async function listMarketingResearchSnapshots(input: {
  workspaceId: string;
  competitorId?: string;
}) {
  const conditions = [
    eq(marketingResearchSnapshots.workspaceId, input.workspaceId),
  ];
  if (input.competitorId)
    conditions.push(
      eq(marketingResearchSnapshots.competitorId, input.competitorId),
    );
  return getDatabase()
    .select()
    .from(marketingResearchSnapshots)
    .where(and(...conditions))
    .orderBy(desc(marketingResearchSnapshots.createdAt))
    .limit(100);
}

export async function findMarketingCompetitor(input: {
  workspaceId: string;
  competitorId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingCompetitors)
    .where(
      and(
        eq(marketingCompetitors.workspaceId, input.workspaceId),
        eq(marketingCompetitors.id, input.competitorId),
        isNull(marketingCompetitors.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getMarketingResearchCurrentTime(): Promise<Date> {
  const result = await getDatabase().execute<{ value: Date }>(
    sql`select now() as value`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("DATABASE_TIME_UNAVAILABLE");
  return row.value;
}
