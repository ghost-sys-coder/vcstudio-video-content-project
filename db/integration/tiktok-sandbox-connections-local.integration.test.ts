import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const pg = new PGlite();
const database = drizzle({ client: pg });
const key = Buffer.alloc(32, 4).toString("base64");
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({ PLATFORM_TOKEN_ENCRYPTION_KEY: key }),
}));
import {
  upsertPlatformConnection,
  updatePlatformConnectionTokens,
  disconnectPlatformConnection,
} from "@/db/commands/platform-connection-commands";
import {
  findPlatformConnectionWithTokens,
  listPlatformConnections,
} from "@/db/repositories/publishing.repository";
import { readTikTokSandboxCredentials } from "@/lib/publishing/tiktok-sandbox-credentials";

const workspaceId = "11111111-1111-4111-8111-111111111111",
  otherWorkspace = "22222222-2222-4222-8222-222222222222";
const connectedByUserId = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await pg.exec(`
    create table workspaces(id uuid primary key);
    create table users(id uuid primary key);
    insert into workspaces values ('${workspaceId}'),('${otherWorkspace}');
    insert into users values ('${connectedByUserId}');
    create table platform_connections (
      id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id),
      platform text not null, external_account_id text not null, external_account_name text not null default '', external_account_url text,
      access_token_sealed text not null, refresh_token_sealed text, access_token_expires_at timestamptz, scopes text not null default '',
      status text not null default 'active', last_error text, connected_by_user_id uuid not null references users(id), disconnected_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique (workspace_id,platform,external_account_id)
    );
    insert into platform_connections(workspace_id,platform,external_account_id,access_token_sealed,connected_by_user_id)
      values ('${workspaceId}','youtube','legacy-channel','legacy-token','${connectedByUserId}');
  `);
  await pg.exec(
    await readFile(
      "migrations/20261105105401_tiktok_sandbox_connection_clients/migration.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await pg.close();
});

function connect(account: string, secret: string, workspace = workspaceId) {
  return upsertPlatformConnection({
    workspaceId: workspace,
    platform: "tiktok",
    connectedByUserId,
    account: {
      externalAccountId: account,
      externalAccountName: account,
      externalAccountUrl: null,
    },
    tokens: {
      accessToken: `access-${account}`,
      refreshToken: `refresh-${account}`,
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      scopes: ["user.info.basic", "video.upload"],
    },
    tikTokSandboxCredentials: {
      clientKey: "sandbox-client",
      clientSecret: secret,
    },
  });
}

describe("sandbox connections on isolated PostgreSQL using real application commands", () => {
  it("adds nullable storage without changing the existing account", async () => {
    expect(
      (
        await pg.query(
          "select external_account_id,access_token_sealed,oauth_client_credentials_sealed from platform_connections",
        )
      ).rows,
    ).toEqual([
      {
        external_account_id: "legacy-channel",
        access_token_sealed: "legacy-token",
        oauth_client_credentials_sealed: null,
      },
    ]);
  });
  it("keeps multiple accounts independent, scopes reads and does not expose sealed credentials", async () => {
    const first = await connect("account-one", "secret-one");
    const second = await connect("account-two", "secret-two");
    await connect("account-one", "other-workspace-secret", otherWorkspace);
    expect(first.id).not.toBe(second.id);
    expect(
      await findPlatformConnectionWithTokens({
        connectionId: first.id,
        workspaceId: otherWorkspace,
      }),
    ).toBeNull();
    expect(readTikTokSandboxCredentials(first, key)?.clientSecret).toBe(
      "secret-one",
    );
    const summaries = await listPlatformConnections({ workspaceId });
    expect(summaries).toHaveLength(3);
    expect(summaries.filter((item) => item.isSandbox)).toHaveLength(2);
    expect(JSON.stringify(summaries)).not.toMatch(
      /secret-one|secret-two|oauthClientCredentialsSealed|accessTokenSealed/,
    );
  });
  it("keeps both accounts connected when they share sandbox credentials and one is reauthorized", async () => {
    const first = await connect(
      "shared-sandbox-first",
      "shared-sandbox-secret",
    );
    const second = await connect(
      "shared-sandbox-second",
      "shared-sandbox-secret",
    );
    const reauthorized = await connect(
      "shared-sandbox-first",
      "shared-sandbox-secret",
    );
    expect(reauthorized.id).toBe(first.id);
    expect(first.id).not.toBe(second.id);
    const connections = await listPlatformConnections({ workspaceId });
    expect(
      connections.filter((item) => [first.id, second.id].includes(item.id)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          status: "active",
          isSandbox: true,
        }),
        expect.objectContaining({
          id: second.id,
          status: "active",
          isSandbox: true,
        }),
      ]),
    );
    const storedSecond = await findPlatformConnectionWithTokens({
      workspaceId,
      connectionId: second.id,
    });
    expect(
      storedSecond && readTikTokSandboxCredentials(storedSecond, key),
    ).toEqual({
      clientKey: "sandbox-client",
      clientSecret: "shared-sandbox-secret",
    });
  });

  it("retains the same account row and sandbox app during token rotation, then clears every credential on disconnect", async () => {
    const original = await connect("rotation-account", "sandbox-secret");
    const again = await connect("rotation-account", "updated-secret");
    expect(again.id).toBe(original.id);
    await updatePlatformConnectionTokens({
      connectionId: original.id,
      workspaceId,
      tokens: {
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
        expiresAt: null,
        scopes: ["video.upload"],
      },
    });
    const rotated = await findPlatformConnectionWithTokens({
      connectionId: original.id,
      workspaceId,
    });
    expect(
      rotated && readTikTokSandboxCredentials(rotated, key)?.clientSecret,
    ).toBe("updated-secret");
    expect(
      await disconnectPlatformConnection({
        connectionId: original.id,
        workspaceId: otherWorkspace,
      }),
    ).toEqual({ disconnected: false });
    await disconnectPlatformConnection({
      connectionId: original.id,
      workspaceId,
    });
    expect(
      await findPlatformConnectionWithTokens({
        connectionId: original.id,
        workspaceId,
      }),
    ).toMatchObject({
      status: "revoked",
      accessTokenSealed: "",
      refreshTokenSealed: null,
      oauthClientCredentialsSealed: null,
    });
  });
  it("refuses app credentials on another platform at the database boundary", async () => {
    await expect(
      pg.query(
        "update platform_connections set oauth_client_credentials_sealed = $1 where platform = 'youtube'",
        ["sealed-value"],
      ),
    ).rejects.toThrow("platform_connections_custom_client_tiktok_only");
  });
});
