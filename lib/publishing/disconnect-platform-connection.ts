import "server-only";

import { disconnectPlatformConnection } from "@/db/commands/platform-connection-commands";
import { findPlatformConnectionWithTokens } from "@/db/repositories/publishing.repository";
import { openSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import { createVideoPublishProvider } from "@/lib/publishing/provider-registry";

export async function disconnectPlatformAuthorization(input: {
  connectionId: string;
  workspaceId: string;
}): Promise<{ disconnected: boolean; providerRevoked: boolean }> {
  const connection = await findPlatformConnectionWithTokens(input);
  if (!connection) return { disconnected: false, providerRevoked: false };

  let providerRevoked = false;
  const provider = createVideoPublishProvider(connection.platform);
  if (provider.revokeAuthorization && connection.accessTokenSealed) {
    try {
      await provider.revokeAuthorization({
        accessToken: openSecret({
          sealed: connection.accessTokenSealed,
          key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
        }),
      });
      providerRevoked = true;
    } catch {
      // Local credential destruction must still succeed if a provider is down.
    }
  }

  const result = await disconnectPlatformConnection(input);
  return { ...result, providerRevoked };
}
