import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  disconnectGoogleBusiness,
  saveGoogleBusinessLocations,
  selectGoogleBusinessLocations,
} from "@/db/commands/google-business-commands";
import { getDatabase } from "@/db/drizzle";
import {
  googleBusinessConnections,
  googleBusinessLocations,
  googleBusinessLocationSnapshots,
  users,
  workspaceMembers,
  workspaces,
  type GoogleBusinessLocationData,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const workspaceIds = new Set<string>();
const userIds = new Set<string>();

const profile: GoogleBusinessLocationData = {
  title: "Kampala Studio",
  storeCode: "KLA-1",
  categories: ["Video production service"],
  primaryCategory: "Video production service",
  description: "A production studio in Kampala.",
  websiteUri: "https://example.com",
  phoneNumbers: ["+256700000000"],
  addressLines: ["Plot 1"],
  locality: "Kampala",
  administrativeArea: "Central Region",
  postalCode: "",
  regionCode: "UG",
  regularHours: ["MONDAY 09:00-17:00"],
  serviceArea: "Kampala",
};

async function createFixture() {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  workspaceIds.add(workspaceId);
  userIds.add(userId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `google-business-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Google Business Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Google Business Workspace",
      slug: `google-business-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  const [connection] = await database
    .insert(googleBusinessConnections)
    .values({
      workspaceId,
      connectedByUserId: userId,
      accessTokenSealed: "test-token",
      refreshTokenSealed: "test-refresh",
      scopes: "https://www.googleapis.com/auth/business.manage",
    })
    .returning();
  if (!connection) throw new Error("fixture connection not created");
  await saveGoogleBusinessLocations({
    workspaceId,
    connectionId: connection.id,
    locations: [
      {
        accountName: "accounts/1",
        accountDisplayName: "Example",
        locationName: `locations/${label}`,
        data: profile,
      },
    ],
  });
  const [location] = await database
    .select()
    .from(googleBusinessLocations)
    .where(eq(googleBusinessLocations.workspaceId, workspaceId));
  if (!location) throw new Error("fixture location not created");
  return { workspaceId, connectionId: connection.id, locationId: location.id };
}

async function cleanup() {
  if (workspaceIds.size)
    await getDatabase()
      .delete(workspaces)
      .where(inArray(workspaces.id, [...workspaceIds]));
  if (userIds.size)
    await getDatabase()
      .delete(users)
      .where(inArray(users.id, [...userIds]));
}

describeDatabase("Google Business Profile persistence (postgres)", () => {
  afterAll(cleanup);

  it("selects a primary location only within its workspace", async () => {
    const owner = await createFixture();
    const other = await createFixture();
    await selectGoogleBusinessLocations({
      workspaceId: owner.workspaceId,
      locationIds: [owner.locationId],
      primaryLocationId: owner.locationId,
    });
    await expect(
      selectGoogleBusinessLocations({
        workspaceId: other.workspaceId,
        locationIds: [owner.locationId],
        primaryLocationId: owner.locationId,
      }),
    ).rejects.toThrow("GOOGLE_BUSINESS_LOCATION_NOT_FOUND");
    const [selected] = await getDatabase()
      .select()
      .from(googleBusinessLocations)
      .where(eq(googleBusinessLocations.id, owner.locationId));
    expect(selected).toMatchObject({ selected: true, isPrimary: true });
  }, 30_000);

  it("revokes credentials without deleting synchronized snapshots", async () => {
    const fixture = await createFixture();
    await selectGoogleBusinessLocations({
      workspaceId: fixture.workspaceId,
      locationIds: [fixture.locationId],
      primaryLocationId: fixture.locationId,
    });
    await disconnectGoogleBusiness({ workspaceId: fixture.workspaceId });
    const [connection] = await getDatabase()
      .select()
      .from(googleBusinessConnections)
      .where(eq(googleBusinessConnections.id, fixture.connectionId));
    const snapshots = await getDatabase()
      .select()
      .from(googleBusinessLocationSnapshots)
      .where(
        eq(googleBusinessLocationSnapshots.workspaceId, fixture.workspaceId),
      );
    const [location] = await getDatabase()
      .select()
      .from(googleBusinessLocations)
      .where(eq(googleBusinessLocations.id, fixture.locationId));
    expect(connection).toMatchObject({
      status: "revoked",
      accessTokenSealed: "",
      refreshTokenSealed: null,
    });
    expect(location).toMatchObject({ selected: false, isPrimary: false });
    expect(snapshots).toHaveLength(1);
  }, 30_000);
});
