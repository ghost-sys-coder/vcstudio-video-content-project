import "server-only";

import { z } from "zod";
import {
  tikTokSandboxCredentialsSchema,
  type TikTokSandboxCredentials,
} from "@studio/contracts/publishing";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import { TikTokConnectionError } from "@/lib/domain/tiktok-connection-error";

const storedSchema = tikTokSandboxCredentialsSchema.extend({
  environment: z.literal("sandbox"),
  workspaceId: z.uuid(),
  externalAccountId: z.string().min(1),
});

export type ConnectionClientContext = {
  platform: string;
  workspaceId?: string;
  externalAccountId?: string;
  oauthClientCredentialsSealed?: string | null;
};

export function sealTikTokSandboxCredentials(input: {
  credentials: TikTokSandboxCredentials;
  workspaceId: string;
  externalAccountId: string;
  key: string;
}): string {
  const value = storedSchema.parse({
    ...input.credentials,
    environment: "sandbox",
    workspaceId: input.workspaceId,
    externalAccountId: input.externalAccountId,
  });
  return sealSecret({ plaintext: JSON.stringify(value), key: input.key });
}

/** Only call with a connection loaded by workspace + id on the server. */
export function readTikTokSandboxCredentials(
  connection: ConnectionClientContext,
  key: string,
): TikTokSandboxCredentials | null {
  if (!connection.oauthClientCredentialsSealed) return null;
  try {
    const stored = storedSchema.parse(
      JSON.parse(
        openSecret({ sealed: connection.oauthClientCredentialsSealed, key }),
      ) as unknown,
    );
    if (
      connection.platform !== "tiktok" ||
      stored.workspaceId !== connection.workspaceId ||
      stored.externalAccountId !== connection.externalAccountId
    )
      throw new Error("CLIENT_BINDING_MISMATCH");
    return { clientKey: stored.clientKey, clientSecret: stored.clientSecret };
  } catch {
    throw new TikTokConnectionError(
      "invalid_sandbox_credentials",
      "The saved TikTok sandbox credentials could not be used. Reconnect this account.",
    );
  }
}
