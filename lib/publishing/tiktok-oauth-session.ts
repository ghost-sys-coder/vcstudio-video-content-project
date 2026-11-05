import { z } from "zod";
import { tikTokSandboxCredentialsSchema } from "@studio/contracts/publishing";
import { openSecret, safeEquals, sealSecret } from "@/lib/crypto/secret-box";
import { TikTokConnectionError } from "@/lib/domain/tiktok-connection-error";

export const TIKTOK_OAUTH_SESSION_COOKIE = "vcstudio_tiktok_sandbox_oauth";
export const TIKTOK_OAUTH_COOKIE_PATH = "/api/tiktok";
const sessionSchema = tikTokSandboxCredentialsSchema.extend({
  workspaceId: z.uuid(),
  userId: z.string().min(1),
  state: z.string().min(1),
  expiresAtMs: z.number().int().positive(),
});

export function createTikTokOAuthSession(
  session: z.infer<typeof sessionSchema>,
  key: string,
): string {
  return sealSecret({
    plaintext: JSON.stringify(sessionSchema.parse(session)),
    key,
  });
}

export function readTikTokOAuthSession(input: {
  sealed: string;
  key: string;
  state: string;
  workspaceId: string;
  userId: string;
  now?: Date;
}) {
  try {
    const session = sessionSchema.parse(
      JSON.parse(
        openSecret({ sealed: input.sealed, key: input.key }),
      ) as unknown,
    );
    if (
      session.expiresAtMs <= (input.now ?? new Date()).getTime() ||
      session.workspaceId !== input.workspaceId ||
      session.userId !== input.userId ||
      !safeEquals(session.state, input.state)
    )
      throw new Error("SESSION_MISMATCH");
    return { clientKey: session.clientKey, clientSecret: session.clientSecret };
  } catch {
    throw new TikTokConnectionError(
      "invalid_sandbox_session",
      "TikTok sandbox authorization expired or changed. Start a new connection.",
    );
  }
}
