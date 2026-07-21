import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  platformConnections,
  type ContentPlatform,
  type PlatformConnection,
} from "@/db/schema";
import { sealSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import type {
  PlatformAccount,
  PlatformTokens,
} from "@/lib/publishing/video-publish-provider";

/**
 * Store (or re-store) a workspace's authorization for a platform account.
 *
 * Re-authorizing the same external account updates the existing row rather than
 * accumulating duplicates, and revives a previously revoked/expired connection.
 * Tokens are sealed before they ever reach SQL.
 */
export async function upsertPlatformConnection(input: {
  workspaceId: string;
  platform: ContentPlatform;
  account: PlatformAccount;
  tokens: PlatformTokens;
  connectedByUserId: string;
}): Promise<PlatformConnection> {
  const { PLATFORM_TOKEN_ENCRYPTION_KEY } = getPublishingEnvironment();
  const now = new Date();
  const accessTokenSealed = sealSecret({
    plaintext: input.tokens.accessToken,
    key: PLATFORM_TOKEN_ENCRYPTION_KEY,
  });
  const refreshTokenSealed = input.tokens.refreshToken
    ? sealSecret({
        plaintext: input.tokens.refreshToken,
        key: PLATFORM_TOKEN_ENCRYPTION_KEY,
      })
    : null;

  const [connection] = await getDatabase()
    .insert(platformConnections)
    .values({
      workspaceId: input.workspaceId,
      platform: input.platform,
      externalAccountId: input.account.externalAccountId,
      externalAccountName: input.account.externalAccountName,
      externalAccountUrl: input.account.externalAccountUrl,
      accessTokenSealed,
      refreshTokenSealed,
      accessTokenExpiresAt: input.tokens.expiresAt,
      scopes: input.tokens.scopes.join(" "),
      status: "active",
      connectedByUserId: input.connectedByUserId,
    })
    .onConflictDoUpdate({
      target: [
        platformConnections.workspaceId,
        platformConnections.platform,
        platformConnections.externalAccountId,
      ],
      set: {
        externalAccountName: input.account.externalAccountName,
        externalAccountUrl: input.account.externalAccountUrl,
        accessTokenSealed,
        // Google omits the refresh token on re-consent in some flows; keep the
        // stored one rather than nulling a still-valid credential.
        ...(refreshTokenSealed ? { refreshTokenSealed } : {}),
        accessTokenExpiresAt: input.tokens.expiresAt,
        scopes: input.tokens.scopes.join(" "),
        status: "active",
        lastError: null,
        disconnectedAt: null,
        connectedByUserId: input.connectedByUserId,
        updatedAt: now,
      },
    })
    .returning();

  if (!connection) throw new Error("PLATFORM_CONNECTION_UPSERT_FAILED");
  return connection;
}

/** Persist rotated tokens after a refresh. */
export async function updatePlatformConnectionTokens(input: {
  connectionId: string;
  workspaceId: string;
  tokens: PlatformTokens;
}): Promise<void> {
  const { PLATFORM_TOKEN_ENCRYPTION_KEY } = getPublishingEnvironment();
  await getDatabase()
    .update(platformConnections)
    .set({
      accessTokenSealed: sealSecret({
        plaintext: input.tokens.accessToken,
        key: PLATFORM_TOKEN_ENCRYPTION_KEY,
      }),
      ...(input.tokens.refreshToken
        ? {
            refreshTokenSealed: sealSecret({
              plaintext: input.tokens.refreshToken,
              key: PLATFORM_TOKEN_ENCRYPTION_KEY,
            }),
          }
        : {}),
      accessTokenExpiresAt: input.tokens.expiresAt,
      status: "active",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(platformConnections.id, input.connectionId),
        eq(platformConnections.workspaceId, input.workspaceId),
      ),
    );
}

/**
 * Mark a connection unusable. Tokens are cleared: once the platform has
 * rejected them they are useless, and holding a dead credential is pure risk.
 */
export async function markPlatformConnectionUnusable(input: {
  connectionId: string;
  workspaceId: string;
  status: "expired" | "revoked";
  safeError: string;
}): Promise<void> {
  await getDatabase()
    .update(platformConnections)
    .set({
      status: input.status,
      lastError: input.safeError,
      refreshTokenSealed: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(platformConnections.id, input.connectionId),
        eq(platformConnections.workspaceId, input.workspaceId),
      ),
    );
}

/**
 * Disconnect an account: destroy both sealed tokens and mark the row revoked.
 *
 * Deliberately a soft disconnect, not a delete. `video_publications.connection_id`
 * is `on delete restrict`, so a hard delete would be permanently blocked by any
 * past publication — and past publications are exactly the history a user wants
 * to keep ("where did this video go?"). Destroying the tokens removes the real
 * liability; the row that remains carries no credential.
 */
export async function disconnectPlatformConnection(input: {
  connectionId: string;
  workspaceId: string;
}): Promise<{ disconnected: boolean }> {
  const result = await getDatabase()
    .update(platformConnections)
    .set({
      status: "revoked",
      accessTokenSealed: "",
      refreshTokenSealed: null,
      accessTokenExpiresAt: null,
      lastError: null,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(platformConnections.id, input.connectionId),
        eq(platformConnections.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: platformConnections.id });
  return { disconnected: result.length === 1 };
}
