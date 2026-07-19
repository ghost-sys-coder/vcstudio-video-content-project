import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { rateLimitCounters } from "@/db/schema";

/**
 * Atomically increments the counter for a scope/window and returns the new
 * count. The unique `(scope_key, window_start)` index makes the upsert the
 * single serialization point, so concurrent requests can never miss a count.
 */
export async function incrementRateLimitCount(input: {
  scopeKey: string;
  windowStart: Date;
}): Promise<number> {
  const [row] = await getDatabase()
    .insert(rateLimitCounters)
    .values({
      scopeKey: input.scopeKey,
      windowStart: input.windowStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimitCounters.scopeKey, rateLimitCounters.windowStart],
      set: {
        count: sql`${rateLimitCounters.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: rateLimitCounters.count });
  return row?.count ?? 0;
}
