import { z } from "zod";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";

export const FACEBOOK_OAUTH_SESSION_COOKIE = "vcstudio_facebook_oauth";

const facebookOAuthSessionSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.string().min(1),
  userAccessToken: z.string().min(1),
  scopes: z.array(z.string()),
  expiresAtMs: z.number().int().positive(),
});

export type FacebookOAuthSession = z.infer<typeof facebookOAuthSessionSchema>;

export function createFacebookOAuthSession(
  input: FacebookOAuthSession,
  key: string,
): string {
  return sealSecret({ plaintext: JSON.stringify(input), key });
}

export function readFacebookOAuthSession(input: {
  sealed: string;
  key: string;
  now?: Date;
}): FacebookOAuthSession {
  const parsed = facebookOAuthSessionSchema.parse(
    JSON.parse(openSecret({ sealed: input.sealed, key: input.key })) as unknown,
  );
  if (parsed.expiresAtMs < (input.now ?? new Date()).getTime())
    throw new Error("FACEBOOK_OAUTH_SESSION_EXPIRED");
  return parsed;
}
