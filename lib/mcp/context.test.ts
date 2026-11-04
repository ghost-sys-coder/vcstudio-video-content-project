import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  user: vi.fn(),
  connection: vi.fn(),
  grant: vi.fn(),
  membership: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: m.auth,
  clerkClient: async () => ({ idPOAuthAccessToken: { verify: m.verify } }),
}));
vi.mock("@/db/repositories/users.repository", () => ({
  findActiveUserByClerkId: m.user,
  upsertSynchronizedUser: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  ensureMcpConnection: m.connection,
  findMcpGrant: m.grant,
  findMcpConnection: m.connection,
}));
vi.mock("@/db/repositories/workspaces.repository", () => ({
  findWorkspaceMembership: m.membership,
}));
vi.mock("@/lib/env/server", () => ({
  getMcpEnvironment: () => ({ ENABLE_MCP: true }),
}));
vi.mock("./config", () => ({ mcpBaseUrl: () => "https://vcstudio.example" }));
import { authenticateMcp, authorizeMcp, authorizeMcpBrowser } from "./context";
import { mcpContextFixture } from "@/lib/test-utils/mcp-fixtures";
const ctx = mcpContextFixture();
afterEach(() => vi.unstubAllEnvs());
function jwt(aud = "https://vcstudio.example/mcp") {
  return `header.${Buffer.from(JSON.stringify({ aud })).toString("base64url")}.verified-by-clerk`;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({
    isAuthenticated: true,
    userId: ctx.principal.clerkUserId,
    clientId: ctx.principal.clientId,
    scopes: ctx.principal.scopes,
    getToken: async () => jwt(),
  });
  m.verify.mockResolvedValue({
    revoked: false,
    expired: false,
    clientId: ctx.principal.clientId,
    subject: ctx.principal.clerkUserId,
  });
  m.user.mockResolvedValue({ id: ctx.principal.userId });
  m.connection.mockResolvedValue(ctx.connection);
  m.grant.mockResolvedValue(ctx.grant);
  m.membership.mockResolvedValue(ctx.membership);
});
describe("authenticated MCP authority", () => {
  it("blocks valid outsider OAuth tokens before any application user access", async () => {
    vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
    vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", "user_owner1,user_owner2");
    await expect(authenticateMcp()).rejects.toMatchObject({
      code: "permission_denied",
    });
    expect(m.user).not.toHaveBeenCalled();
    expect(m.connection).not.toHaveBeenCalled();
  });
  it("retains the existing owner's MCP authentication", async () => {
    vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
    vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", ctx.principal.clerkUserId);
    await expect(authenticateMcp()).resolves.toMatchObject({
      userId: ctx.principal.userId,
    });
  });
  it("accepts only resource-bound OAuth tokens and checks external token revocation", async () => {
    expect((await authenticateMcp()).userId).toBe(ctx.principal.userId);
    for (const changed of [
      { revoked: true },
      { expired: true },
      { clientId: "other-client" },
      { subject: "other-user" },
    ]) {
      m.verify.mockResolvedValue({
        revoked: false,
        expired: false,
        clientId: ctx.principal.clientId,
        subject: ctx.principal.clerkUserId,
        ...changed,
      });
      await expect(authenticateMcp()).rejects.toThrow("revoked");
    }
  });
  it("rejects missing identity and cross-resource tokens before reading application content", async () => {
    m.auth.mockResolvedValue({ isAuthenticated: false });
    await expect(authenticateMcp()).rejects.toThrow("own account");
    m.auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "clerk",
      clientId: "client",
      getToken: async () => jwt("https://other.example/mcp"),
    });
    await expect(authenticateMcp()).rejects.toThrow("resource");
    expect(m.user).not.toHaveBeenCalled();
  });
  it("rejects workspace tampering, membership changes, revoked connections and missing scopes", async () => {
    m.membership.mockResolvedValue(null);
    await expect(
      authorizeMcp(ctx.principal, "another-workspace", "vcstudio:read"),
    ).rejects.toThrow("workspace");
    m.membership.mockResolvedValue({ ...ctx.membership, role: "viewer" });
    await expect(
      authorizeMcp(ctx.principal, ctx.workspaceId, "vcstudio:publish"),
    ).rejects.toThrow("role");
    m.membership.mockResolvedValue(ctx.membership);
    m.connection.mockResolvedValue({
      ...ctx.connection,
      revokedAt: new Date(),
    });
    await expect(
      authorizeMcp(ctx.principal, ctx.workspaceId, "vcstudio:read"),
    ).rejects.toThrow("permission");
    m.connection.mockResolvedValue(ctx.connection);
    await expect(
      authorizeMcp(
        { ...ctx.principal, scopes: ["vcstudio:read"] },
        ctx.workspaceId,
        "vcstudio:publish",
      ),
    ).rejects.toThrow("permission");
  });
  it("requires ownership and an existing workspace grant for browser approval", async () => {
    m.connection.mockResolvedValue(null);
    await expect(
      authorizeMcpBrowser(
        "other-user",
        ctx.connection.id,
        ctx.workspaceId,
        "vcstudio:publish",
      ),
    ).rejects.toThrow("unavailable");
    expect(m.connection).toHaveBeenCalledWith(ctx.connection.id, "other-user");
  });
});
