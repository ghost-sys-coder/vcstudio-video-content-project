import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandContextSnapshots,
  type MarketingBrandContextSnapshot,
} from "@/db/schema";

export async function findSnapshotByFingerprint(input: {
  workspaceId: string;
  sourceFingerprint: string;
}): Promise<MarketingBrandContextSnapshot | null> {
  const [snapshot] = await getDatabase()
    .select()
    .from(marketingBrandContextSnapshots)
    .where(
      and(
        eq(marketingBrandContextSnapshots.workspaceId, input.workspaceId),
        eq(
          marketingBrandContextSnapshots.sourceFingerprint,
          input.sourceFingerprint,
        ),
      ),
    )
    .limit(1);
  return snapshot ?? null;
}

/**
 * Stores a compiled context block, reusing the row when nothing changed.
 *
 * `onConflictDoNothing` plus a re-read rather than an upsert, because a
 * snapshot is **immutable**: if a row already exists for this fingerprint then
 * by definition it holds the same text, and rewriting it would only churn an
 * `updatedAt` that provenance depends on staying still. The conflict target is
 * the per-workspace unique index, so two concurrent compilations of the same
 * brand settle on one row instead of racing.
 */
export async function saveBrandContextSnapshot(input: {
  workspaceId: string;
  sourceFingerprint: string;
  promptVersion: string;
  contextVersion: number;
  compiledText: string;
  tokenEstimate: number;
  includedDocumentIds: string[];
  omittedDocumentCount: number;
  truncated: boolean;
}): Promise<MarketingBrandContextSnapshot> {
  const [inserted] = await getDatabase()
    .insert(marketingBrandContextSnapshots)
    .values(input)
    .onConflictDoNothing({
      target: [
        marketingBrandContextSnapshots.workspaceId,
        marketingBrandContextSnapshots.sourceFingerprint,
      ],
    })
    .returning();

  if (inserted) return inserted;

  const existing = await findSnapshotByFingerprint({
    workspaceId: input.workspaceId,
    sourceFingerprint: input.sourceFingerprint,
  });
  if (!existing) throw new Error("MARKETING_BRAND_CONTEXT_SNAPSHOT_NOT_SAVED");
  return existing;
}
