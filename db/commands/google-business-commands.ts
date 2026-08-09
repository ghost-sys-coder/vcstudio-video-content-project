import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  googleBusinessConnections,
  googleBusinessLocations,
  type GoogleBusinessLocationData,
} from "@/db/schema";
import { sealSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import type { GoogleBusinessTokens } from "@/lib/marketing/integrations/google-business-provider";

export async function upsertGoogleBusinessConnection(input: {
  workspaceId: string;
  userId: string;
  tokens: GoogleBusinessTokens;
}) {
  const key = getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY;
  const [connection] = await getDatabase()
    .insert(googleBusinessConnections)
    .values({
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      accessTokenSealed: sealSecret({
        plaintext: input.tokens.accessToken,
        key,
      }),
      refreshTokenSealed: input.tokens.refreshToken
        ? sealSecret({ plaintext: input.tokens.refreshToken, key })
        : null,
      accessTokenExpiresAt: input.tokens.expiresAt,
      scopes: input.tokens.scopes.join(" "),
      status: "active",
    })
    .onConflictDoUpdate({
      target: googleBusinessConnections.workspaceId,
      set: {
        accessTokenSealed: sealSecret({
          plaintext: input.tokens.accessToken,
          key,
        }),
        ...(input.tokens.refreshToken
          ? {
              refreshTokenSealed: sealSecret({
                plaintext: input.tokens.refreshToken,
                key,
              }),
            }
          : {}),
        accessTokenExpiresAt: input.tokens.expiresAt,
        scopes: input.tokens.scopes.join(" "),
        status: "active",
        lastError: null,
        disconnectedAt: null,
        connectedByUserId: input.userId,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!connection) throw new Error("GOOGLE_BUSINESS_CONNECTION_NOT_SAVED");
  return connection;
}

export async function updateGoogleBusinessTokens(input: {
  workspaceId: string;
  connectionId: string;
  tokens: GoogleBusinessTokens;
}) {
  const key = getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY;
  await getDatabase()
    .update(googleBusinessConnections)
    .set({
      accessTokenSealed: sealSecret({
        plaintext: input.tokens.accessToken,
        key,
      }),
      ...(input.tokens.refreshToken
        ? {
            refreshTokenSealed: sealSecret({
              plaintext: input.tokens.refreshToken,
              key,
            }),
          }
        : {}),
      accessTokenExpiresAt: input.tokens.expiresAt,
      scopes: input.tokens.scopes.join(" "),
      status: "active",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(googleBusinessConnections.id, input.connectionId),
        eq(googleBusinessConnections.workspaceId, input.workspaceId),
      ),
    );
}

export async function saveGoogleBusinessLocations(input: {
  workspaceId: string;
  connectionId: string;
  locations: {
    accountName: string;
    accountDisplayName: string;
    locationName: string;
    data: GoogleBusinessLocationData;
  }[];
  providerRequestId?: string | null;
}) {
  const now = new Date();
  const database = getDatabase();
  for (const location of input.locations) {
    const locationId = randomUUID();
    const checksum = createHash("sha256")
      .update(JSON.stringify(location.data))
      .digest("hex");
    // One statement keeps the location upsert and immutable snapshot atomic
    // under the Neon HTTP driver, which does not support callback transactions.
    await database.execute(sql`
      with saved as (
        insert into google_business_locations (
          id, workspace_id, connection_id, account_name, account_display_name,
          location_name, title, profile_data, last_synced_at, created_at, updated_at
        ) values (
          ${locationId}, ${input.workspaceId}, ${input.connectionId},
          ${location.accountName}, ${location.accountDisplayName},
          ${location.locationName}, ${location.data.title},
          ${JSON.stringify(location.data)}::jsonb, ${now}, ${now}, ${now}
        )
        on conflict (workspace_id, location_name) do update set
          account_name = excluded.account_name,
          account_display_name = excluded.account_display_name,
          title = excluded.title,
          profile_data = excluded.profile_data,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at
        returning id
      )
      insert into google_business_location_snapshots (
        workspace_id, connection_id, location_id, checksum, profile_data,
        provider_request_id, created_at
      )
      select ${input.workspaceId}, ${input.connectionId}, saved.id, ${checksum},
        ${JSON.stringify(location.data)}::jsonb,
        ${input.providerRequestId ?? null}, ${now}
      from saved
      on conflict (workspace_id, location_id, checksum) do nothing
    `);
  }
  await database
    .update(googleBusinessConnections)
    .set({
      syncStatus: "succeeded",
      lastSyncedAt: now,
      lastSyncAttemptAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(googleBusinessConnections.id, input.connectionId),
        eq(googleBusinessConnections.workspaceId, input.workspaceId),
      ),
    );
}

export async function selectGoogleBusinessLocations(input: {
  workspaceId: string;
  locationIds: string[];
  primaryLocationId: string;
}) {
  if (!input.locationIds.includes(input.primaryLocationId))
    throw new Error("GOOGLE_BUSINESS_PRIMARY_NOT_SELECTED");
  const database = getDatabase();
  const owned = await database
    .select({ id: googleBusinessLocations.id })
    .from(googleBusinessLocations)
    .where(
      and(
        eq(googleBusinessLocations.workspaceId, input.workspaceId),
        inArray(googleBusinessLocations.id, input.locationIds),
      ),
    );
  if (owned.length !== new Set(input.locationIds).size)
    throw new Error("GOOGLE_BUSINESS_LOCATION_NOT_FOUND");
  await database.batch([
    database
      .update(googleBusinessLocations)
      .set({ selected: false, isPrimary: false, updatedAt: new Date() })
      .where(eq(googleBusinessLocations.workspaceId, input.workspaceId)),
    database
      .update(googleBusinessLocations)
      .set({
        selected: true,
        isPrimary: sql`${googleBusinessLocations.id} = ${input.primaryLocationId}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(googleBusinessLocations.workspaceId, input.workspaceId),
          inArray(googleBusinessLocations.id, input.locationIds),
        ),
      ),
  ]);
}

export async function markGoogleBusinessSyncFailed(input: {
  workspaceId: string;
  connectionId: string;
  safeError: string;
  expired?: boolean;
}) {
  await getDatabase()
    .update(googleBusinessConnections)
    .set({
      syncStatus: "failed",
      status: input.expired ? "expired" : "active",
      lastSyncAttemptAt: new Date(),
      lastError: input.safeError,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(googleBusinessConnections.id, input.connectionId),
        eq(googleBusinessConnections.workspaceId, input.workspaceId),
      ),
    );
}

export async function disconnectGoogleBusiness(input: { workspaceId: string }) {
  const database = getDatabase();
  const [, result] = await database.batch([
    database
      .update(googleBusinessLocations)
      .set({ selected: false, isPrimary: false, updatedAt: new Date() })
      .where(eq(googleBusinessLocations.workspaceId, input.workspaceId)),
    database
      .update(googleBusinessConnections)
      .set({
        accessTokenSealed: "",
        refreshTokenSealed: null,
        accessTokenExpiresAt: null,
        status: "revoked",
        disconnectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(googleBusinessConnections.workspaceId, input.workspaceId),
          ne(googleBusinessConnections.status, "revoked"),
        ),
      )
      .returning({ id: googleBusinessConnections.id }),
  ]);
  return result[0] ?? null;
}
