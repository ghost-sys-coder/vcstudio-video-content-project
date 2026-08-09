import "server-only";

import {
  markGoogleBusinessSyncFailed,
  saveGoogleBusinessLocations,
  updateGoogleBusinessTokens,
} from "@/db/commands/google-business-commands";
import { findGoogleBusinessConnection } from "@/db/repositories/google-business.repository";
import { openSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import {
  GoogleBusinessProviderError,
  listGoogleBusinessLocations,
  refreshGoogleBusinessToken,
} from "@/lib/marketing/integrations/google-business-provider";
import { normalizeGoogleBusinessLocation } from "@/lib/marketing/integrations/google-business-normalization";

export async function syncGoogleBusiness(input: { workspaceId: string }) {
  const connection = await findGoogleBusinessConnection(input);
  if (!connection || connection.status === "revoked")
    throw new Error("GOOGLE_BUSINESS_NOT_CONNECTED");
  const key = getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY;
  let accessToken = openSecret({ sealed: connection.accessTokenSealed, key });
  try {
    if (
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000
    ) {
      if (!connection.refreshTokenSealed)
        throw new GoogleBusinessProviderError(
          "authorization",
          "Google Business Profile must be reconnected.",
        );
      const refreshToken = openSecret({
        sealed: connection.refreshTokenSealed,
        key,
      });
      const tokens = await refreshGoogleBusinessToken(refreshToken);
      await updateGoogleBusinessTokens({
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        tokens,
      });
      accessToken = tokens.accessToken;
    }
    const locations = await listGoogleBusinessLocations(accessToken);
    await saveGoogleBusinessLocations({
      workspaceId: input.workspaceId,
      connectionId: connection.id,
      locations: locations.map((location) => ({
        accountName: location.accountName,
        accountDisplayName: location.accountDisplayName,
        locationName: location.name,
        data: normalizeGoogleBusinessLocation(location),
      })),
    });
    return { locations: locations.length };
  } catch (error) {
    const providerError =
      error instanceof GoogleBusinessProviderError ? error : null;
    await markGoogleBusinessSyncFailed({
      workspaceId: input.workspaceId,
      connectionId: connection.id,
      safeError:
        providerError?.safeMessage ??
        "Google Business Profile could not be synchronized.",
      expired: providerError?.category === "authorization",
    });
    throw error;
  }
}
