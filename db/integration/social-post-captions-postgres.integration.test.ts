import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSocialPost } from "@/db/commands/social-post-commands";
import { createSocialPostTargets } from "@/db/commands/social-post-target-commands";
import { getDatabase } from "@/db/drizzle";
import {
  platformConnections,
  socialPostTargets,
  users,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const workspaceIds = new Set<string>();
const userIds = new Set<string>();

async function createFixture() {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  workspaceIds.add(workspaceId);
  userIds.add(userId);
  await database.insert(users).values({
    id: userId,
    clerkUserId: `captions-${label}`,
    email: `${label}@integration.invalid`,
    displayName: "Caption Fixture",
  });
  await database.insert(workspaces).values({
    id: workspaceId,
    name: "Caption Workspace",
    slug: `captions-${label}`,
    createdByUserId: userId,
  });
  const [connection] = await database
    .insert(platformConnections)
    .values({
      workspaceId,
      platform: "linkedin",
      externalAccountId: `account-${label}`,
      externalAccountName: "Company Page",
      accessTokenSealed: "sealed-test-token",
      connectedByUserId: userId,
    })
    .returning();
  const post = await createSocialPost({
    workspaceId,
    createdByUserId: userId,
    name: "Tailored post",
    projectId: null,
  });
  if (!connection) throw new Error("Connection fixture was not created.");
  return { connection, post, workspaceId };
}

async function cleanup() {
  if (workspaceIds.size) {
    await getDatabase()
      .delete(socialPostTargets)
      .where(inArray(socialPostTargets.workspaceId, [...workspaceIds]));
    await getDatabase()
      .delete(platformConnections)
      .where(inArray(platformConnections.workspaceId, [...workspaceIds]));
    await getDatabase()
      .delete(workspaces)
      .where(inArray(workspaces.id, [...workspaceIds]));
  }
  if (userIds.size)
    await getDatabase()
      .delete(users)
      .where(inArray(users.id, [...userIds]));
}

describeDatabase("social post captions (postgres)", () => {
  afterAll(cleanup);

  it("snapshots a platform caption on its destination", async () => {
    const fixture = await createFixture();
    const [target] = await createSocialPostTargets({
      workspaceId: fixture.workspaceId,
      postId: fixture.post.id,
      targets: [
        {
          platform: "linkedin",
          connectionId: fixture.connection.id,
          idempotencyKey: `caption-${randomUUID()}`,
          overrideBodyPlainText: "LinkedIn-specific launch copy",
        },
      ],
    });
    const [stored] = await getDatabase()
      .select()
      .from(socialPostTargets)
      .where(eq(socialPostTargets.id, target?.id ?? randomUUID()));
    expect(stored?.overrideBodyPlainText).toBe("LinkedIn-specific launch copy");
  }, 30_000);
});
