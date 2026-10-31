import "server-only";

import { disconnectPlatformConnection } from "@/db/commands/platform-connection-commands";
import { findPlatformConnectionWithTokens } from "@/db/repositories/publishing.repository";
import { openSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import { createConnectionOAuthProvider } from "@/lib/publishing/social-post-registry";

export async function disconnectPlatformAuthorization(input: {
  connectionId: string;
  workspaceId: string;
}): Promise<{ disconnected: boolean; providerRevoked: boolean }> {
  const connection = await findPlatformConnectionWithTokens(input);
  if (!connection) return { disconnected: false, providerRevoked: false };

  let providerRevoked = false;
  if (connection.accessTokenSealed) {
    try {
      const provider = createConnectionOAuthProvider(connection);
      if (provider.revokeAuthorization) {
        await provider.revokeAuthorization({
          accessToken: openSecret({
            sealed: connection.accessTokenSealed,
            key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
          }),
        });
        providerRevoked = true;
      }
    } catch {
      // Provider construction, decryption, and revocation are all best effort.
      // None may prevent destroying this workspace's saved credentials.
      console.warn(
        "Platform revocation unavailable; clearing local credentials.",
        {
          platform: connection.platform,
        },
      );
    }
  }

  const result = await disconnectPlatformConnection(input);
  return { ...result, providerRevoked };
}
