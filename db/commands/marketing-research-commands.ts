import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingCompetitors, marketingResearchSnapshots } from "@/db/schema";
import type {
  ResearchCitation,
  ResearchSnapshotDocument,
} from "@/lib/schemas/marketing-research";

export async function createMarketingCompetitor(input: {
  workspaceId: string;
  name: string;
  websiteUrl: string | null;
  notes: string;
  createdByUserId: string;
}) {
  const [row] = await getDatabase()
    .insert(marketingCompetitors)
    .values(input)
    .returning();
  if (!row) throw new Error("MARKETING_COMPETITOR_NOT_CREATED");
  return row;
}

export async function createPendingResearchSnapshot(input: {
  id: string;
  workspaceId: string;
  kind: "competitor" | "trend";
  competitorId: string | null;
  topic: string;
  queries: string[];
  provider: string;
  freshnessWindowDays: number;
  expiresAt: Date;
  runId: string;
}) {
  await getDatabase().insert(marketingResearchSnapshots).values(input);
}

export async function markResearchSnapshotRunning(input: {
  workspaceId: string;
  id: string;
}) {
  await getDatabase()
    .update(marketingResearchSnapshots)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(
        eq(marketingResearchSnapshots.workspaceId, input.workspaceId),
        eq(marketingResearchSnapshots.id, input.id),
        eq(marketingResearchSnapshots.status, "pending"),
      ),
    );
}

export async function completeResearchSnapshot(input: {
  workspaceId: string;
  id: string;
  providerRequestId: string | null;
  resultDocument: ResearchSnapshotDocument;
  citations: ResearchCitation[];
  resultHash: string;
}) {
  await getDatabase()
    .update(marketingResearchSnapshots)
    .set({
      status: "succeeded",
      providerRequestId: input.providerRequestId,
      resultDocument: input.resultDocument,
      citations: input.citations,
      resultHash: input.resultHash,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingResearchSnapshots.workspaceId, input.workspaceId),
        eq(marketingResearchSnapshots.id, input.id),
      ),
    );
}

export async function failResearchSnapshot(input: {
  workspaceId: string;
  id: string;
  category: string;
  message: string;
}) {
  await getDatabase()
    .update(marketingResearchSnapshots)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingResearchSnapshots.workspaceId, input.workspaceId),
        eq(marketingResearchSnapshots.id, input.id),
      ),
    );
}

export async function markCompetitorResearched(input: {
  workspaceId: string;
  competitorId: string;
}) {
  await getDatabase()
    .update(marketingCompetitors)
    .set({ lastResearchedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(marketingCompetitors.workspaceId, input.workspaceId),
        eq(marketingCompetitors.id, input.competitorId),
      ),
    );
}
