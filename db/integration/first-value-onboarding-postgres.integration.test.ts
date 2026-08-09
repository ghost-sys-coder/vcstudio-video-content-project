import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import { loadFirstValueFacts } from "@/db/repositories/first-value-onboarding.repository";
import { users, workspaceMembers, workspaces } from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const ids: { workspaceId?: string; userId?: string } = {};

describeDatabase("first-value onboarding PostgreSQL", () => {
  it("scopes an empty workspace and derives every milestone as incomplete", async () => {
    const database = getDatabase();
    ids.userId = randomUUID();
    ids.workspaceId = randomUUID();
    await database.batch([
      database.insert(users).values({
        id: ids.userId,
        clerkUserId: `onboarding-${ids.userId}`,
        email: `${ids.userId}@integration.invalid`,
        displayName: "Onboarding Fixture",
      }),
      database.insert(workspaces).values({
        id: ids.workspaceId,
        name: "Onboarding Fixture",
        slug: `onboarding-${ids.workspaceId}`,
        createdByUserId: ids.userId,
      }),
      database.insert(workspaceMembers).values({
        workspaceId: ids.workspaceId,
        userId: ids.userId,
        role: "owner",
      }),
    ]);
    expect(
      Object.values(await loadFirstValueFacts(ids.workspaceId)).every(
        (value) => value === false,
      ),
    ).toBe(true);
  });
});

afterAll(async () => {
  if (!enabled) return;
  const database = getDatabase();
  if (ids.workspaceId)
    await database.delete(workspaces).where(eq(workspaces.id, ids.workspaceId));
  if (ids.userId) await database.delete(users).where(eq(users.id, ids.userId));
});
