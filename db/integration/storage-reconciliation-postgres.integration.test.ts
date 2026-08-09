import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDatabase } from "@/db/drizzle";
import {
  getAbandonedUploadCheckpoint,
  isStorageObjectReferenced,
  saveAbandonedUploadCheckpoint,
} from "@/db/repositories/storage-reconciliation.repository";
import {
  storageObjects,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const workspaceIds = new Set<string>();
const userIds = new Set<string>();

describeDatabase("storage reconciliation PostgreSQL", () => {
  it("recognizes referenced objects and rejects an unreferenced tenant key", async () => {
    const database = getDatabase();
    const userId = randomUUID();
    const workspaceId = randomUUID();
    const key = `workspaces/${workspaceId}/branding/logos/${randomUUID()}.png`;
    userIds.add(userId);
    workspaceIds.add(workspaceId);
    await database.batch([
      database.insert(users).values({
        id: userId,
        clerkUserId: `storage-${userId}`,
        email: `${userId}@integration.invalid`,
        displayName: "Storage Fixture",
      }),
      database.insert(workspaces).values({
        id: workspaceId,
        name: "Storage Fixture",
        slug: `storage-${workspaceId}`,
        createdByUserId: userId,
      }),
      database
        .insert(workspaceMembers)
        .values({ workspaceId, userId, role: "owner" }),
      database.insert(storageObjects).values({
        workspaceId,
        kind: "workspace_logo",
        objectKey: key,
        contentType: "image/png",
        sizeBytes: 10,
        createdByUserId: userId,
      }),
    ]);
    expect(await isStorageObjectReferenced(key)).toBe(true);
    expect(
      await isStorageObjectReferenced(
        `workspaces/${workspaceId}/library/${randomUUID()}.webp`,
      ),
    ).toBe(false);
  });

  it("updates one durable checkpoint idempotently", async () => {
    const first = `workspaces/${randomUUID()}/a`;
    const second = `workspaces/${randomUUID()}/b`;
    await saveAbandonedUploadCheckpoint(first);
    await saveAbandonedUploadCheckpoint(second);
    expect(await getAbandonedUploadCheckpoint()).toBe(second);
  });
});

afterAll(async () => {
  if (!enabled) return;
  const database = getDatabase();
  for (const workspaceId of workspaceIds)
    await database.delete(workspaces).where(eq(workspaces.id, workspaceId));
  for (const userId of userIds)
    await database.delete(users).where(eq(users.id, userId));
});
