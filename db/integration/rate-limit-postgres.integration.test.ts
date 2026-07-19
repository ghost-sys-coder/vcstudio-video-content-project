import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { incrementRateLimitCount } from "@/db/repositories/rate-limit.repository";
import { resolveRateWindowStart } from "@/lib/rate-limit/rate-limit";
import { getDatabase } from "@/db/drizzle";
import { rateLimitCounters } from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const scopeKeys = new Set<string>();

async function cleanup(): Promise<void> {
  if (scopeKeys.size > 0)
    await getDatabase()
      .delete(rateLimitCounters)
      .where(inArray(rateLimitCounters.scopeKey, [...scopeKeys]));
  scopeKeys.clear();
}

describeDatabase("rate limit counter invariants", () => {
  afterAll(cleanup);

  it("atomically increments within a window and resets across windows", async () => {
    const scopeKey = `rate-test:${randomUUID()}`;
    scopeKeys.add(scopeKey);
    const windowStart = resolveRateWindowStart(
      new Date("2026-07-19T12:00:30Z"),
      60,
    );

    const first = await incrementRateLimitCount({ scopeKey, windowStart });
    const second = await incrementRateLimitCount({ scopeKey, windowStart });
    expect(first).toBe(1);
    expect(second).toBe(2);

    const nextWindow = resolveRateWindowStart(
      new Date("2026-07-19T12:01:30Z"),
      60,
    );
    const third = await incrementRateLimitCount({
      scopeKey,
      windowStart: nextWindow,
    });
    expect(third).toBe(1);

    const rows = await getDatabase()
      .select()
      .from(rateLimitCounters)
      .where(eq(rateLimitCounters.scopeKey, scopeKey));
    expect(rows).toHaveLength(2);
  });
});
