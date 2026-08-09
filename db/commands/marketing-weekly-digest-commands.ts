import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingWeeklyDigestAcknowledgements,
  marketingWeeklyDigests,
} from "@/db/schema";

export async function acknowledgeMarketingWeeklyDigest(input: {
  workspaceId: string;
  digestId: string;
  userId: string;
}) {
  const database = getDatabase();
  const [digest] = await database
    .select({ id: marketingWeeklyDigests.id })
    .from(marketingWeeklyDigests)
    .where(
      and(
        eq(marketingWeeklyDigests.id, input.digestId),
        eq(marketingWeeklyDigests.workspaceId, input.workspaceId),
        eq(marketingWeeklyDigests.status, "ready"),
      ),
    )
    .limit(1);
  if (!digest) throw new Error("MARKETING_WEEKLY_DIGEST_NOT_FOUND");
  const now = new Date();
  await database
    .insert(marketingWeeklyDigestAcknowledgements)
    .values({ ...input, readAt: now, acknowledgedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        marketingWeeklyDigestAcknowledgements.digestId,
        marketingWeeklyDigestAcknowledgements.userId,
      ],
      set: { acknowledgedAt: now, updatedAt: now },
    });
}
