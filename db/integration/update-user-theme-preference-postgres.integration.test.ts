import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { updateUserThemePreference } from "@/db/commands/update-user-theme-preference.command";
import { getDatabase } from "@/db/drizzle";
import { users } from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureUserIds = new Set<string>();

async function createFixtureUser() {
  const userId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);

  await getDatabase()
    .insert(users)
    .values({
      id: userId,
      clerkUserId: `theme-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Theme Fixture",
    });

  return userId;
}

describeDatabase("update user theme preference (postgres)", () => {
  afterAll(async () => {
    if (!enabled) return;
    const userIds = [...fixtureUserIds];
    if (userIds.length > 0)
      await getDatabase().delete(users).where(inArray(users.id, userIds));
    fixtureUserIds.clear();
  });

  it(
    "defaults to light and persists a change to dark",
    { timeout: 60_000 },
    async () => {
      const userId = await createFixtureUser();

      const [initial] = await getDatabase()
        .select()
        .from(users)
        .where(eq(users.id, userId));
      expect(initial?.themePreference).toBe("light");

      const updated = await updateUserThemePreference({
        userId,
        theme: "dark",
      });
      expect(updated.themePreference).toBe("dark");

      const [persisted] = await getDatabase()
        .select()
        .from(users)
        .where(eq(users.id, userId));
      expect(persisted?.themePreference).toBe("dark");
    },
  );
});
