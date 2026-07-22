import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  findConnection: vi.fn(),
  openSecret: vi.fn(),
  revokeAuthorization: vi.fn(),
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
vi.mock("@/lib/publishing/provider-registry", () => ({
  createVideoPublishProvider: () => ({
    revokeAuthorization: mocks.revokeAuthorization,
  }),
}));

import { disconnectPlatformAuthorization } from "@/lib/publishing/disconnect-platform-connection";

const input = { connectionId: "connection-id", workspaceId: "workspace-id" };

describe("disconnectPlatformAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConnection.mockResolvedValue({
      platform: "tiktok",
      accessTokenSealed: "sealed-token",
    });
    mocks.openSecret.mockReturnValue("access-token");
    mocks.disconnect.mockResolvedValue({ disconnected: true });
  });

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
});
