import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  findConnection: vi.fn(),
  openSecret: vi.fn(),
  revokeAuthorization: vi.fn(),
  createProvider: vi.fn(),
}));

vi.mock("@/db/commands/platform-connection-commands", () => ({
  disconnectPlatformConnection: mocks.disconnect,
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  findPlatformConnectionWithTokens: mocks.findConnection,
}));
vi.mock("@/lib/crypto/secret-box", () => ({ openSecret: mocks.openSecret }));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({ PLATFORM_TOKEN_ENCRYPTION_KEY: "key" }),
}));
vi.mock("@/lib/publishing/social-post-registry", () => ({
  createConnectionOAuthProvider: mocks.createProvider,
}));

import { disconnectPlatformAuthorization } from "@/lib/publishing/disconnect-platform-connection";

const input = { connectionId: "connection-id", workspaceId: "workspace-id" };

describe("disconnectPlatformAuthorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.createProvider.mockReturnValue({
      revokeAuthorization: mocks.revokeAuthorization,
    });
    mocks.findConnection.mockResolvedValue({
      platform: "tiktok",
      accessTokenSealed: "sealed-token",
    });
    mocks.openSecret.mockReturnValue("access-token");
    mocks.disconnect.mockResolvedValue({ disconnected: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it("revokes TikTok before destroying the local credential", async () => {
    mocks.revokeAuthorization.mockResolvedValue(undefined);

    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: true,
    });
    expect(mocks.revokeAuthorization).toHaveBeenCalledWith({
      accessToken: "access-token",
    });
    expect(mocks.disconnect).toHaveBeenCalledWith(input);
  });

  it("still destroys the local credential when provider revocation fails", async () => {
    mocks.revokeAuthorization.mockRejectedValue(
      new Error("provider unavailable"),
    );

    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.disconnect).toHaveBeenCalledWith(input);
  });

  it("uses the OAuth provider for LinkedIn and skips unsupported remote revocation", async () => {
    mocks.findConnection.mockResolvedValue({
      platform: "linkedin",
      accessTokenSealed: "sealed-token",
    });
    mocks.createProvider.mockReturnValue({});
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.createProvider).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ platform: "linkedin" }),
    );
    expect(mocks.openSecret).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith(input);
  });

  it("clears saved credentials even when provider configuration is missing", async () => {
    mocks.createProvider.mockImplementation(() => {
      throw new Error("secret configuration detail");
    });
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith(input);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "Platform revocation unavailable; clearing local credentials.",
      { platform: "tiktok" },
    );
  });

  it("clears saved credentials even when their encryption key can no longer open them", async () => {
    mocks.openSecret.mockImplementation(() => {
      throw new Error("key changed");
    });
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.revokeAuthorization).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith(input);
  });

  it("does not construct a provider for an already-cleared credential", async () => {
    mocks.findConnection.mockResolvedValue({
      platform: "linkedin",
      accessTokenSealed: "",
    });
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledWith(input);
  });

  it("does no provider or mutation work for a missing workspace-scoped connection", async () => {
    mocks.findConnection.mockResolvedValue(null);
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: false,
      providerRevoked: false,
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it("propagates a local credential-destruction failure instead of reporting success", async () => {
    mocks.disconnect.mockRejectedValue(new Error("database unavailable"));
    await expect(disconnectPlatformAuthorization(input)).rejects.toThrow(
      "database unavailable",
    );
  });
});
