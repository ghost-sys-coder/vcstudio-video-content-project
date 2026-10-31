import "server-only";

import { z } from "zod";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import type { PlatformTokens } from "@/lib/publishing/platform-oauth-provider";
import { LINKEDIN_PAGES_SELECTION_PATH } from "@/lib/publishing/linkedin-pages-navigation";

export const LINKEDIN_PAGES_SESSION_COOKIE =
  "vcstudio_linkedin_pages_selection";
export const LINKEDIN_PAGES_STATE_COOKIE = "vcstudio_linkedin_pages_state";
export const LINKEDIN_PAGES_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: LINKEDIN_PAGES_SELECTION_PATH,
} as const;
export const LINKEDIN_PAGES_STATE_COOKIE_OPTIONS = {
  ...LINKEDIN_PAGES_COOKIE_OPTIONS,
  path: "/api/linkedin/pages",
} as const;

const sessionSchema = z.object({
  purpose: z.literal("linkedin-pages-selection"),
  workspaceId: z.uuid(),
  userId: z.string().min(1),
  accessToken: z.string().min(1).max(2048),
  refreshToken: z.string().min(1).max(2048).nullable(),
  tokenExpiresAtMs: z.number().int().positive().nullable(),
  scopes: z
    .array(z.string())
    .max(30)
    .refine((scopes) =>
      ["rw_organization_admin", "w_organization_social"].every((scope) =>
        scopes.includes(scope),
      ),
    ),
  expiresAtMs: z.number().int().positive(),
});
export type LinkedInPagesSession = z.infer<typeof sessionSchema>;

export function createLinkedInPagesSession(
  input: {
    workspaceId: string;
    userId: string;
    tokens: PlatformTokens;
    ttlSeconds: number;
  },
  key: string,
): string {
  const session = sessionSchema.parse({
    purpose: "linkedin-pages-selection",
    workspaceId: input.workspaceId,
    userId: input.userId,
    accessToken: input.tokens.accessToken,
    refreshToken: input.tokens.refreshToken,
    tokenExpiresAtMs: input.tokens.expiresAt?.getTime() ?? null,
    scopes: input.tokens.scopes,
    expiresAtMs: Math.min(
      Date.now() + Math.min(input.ttlSeconds, 600) * 1000,
      input.tokens.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    ),
  });
  const sealed = sealSecret({ plaintext: JSON.stringify(session), key });
  if (sealed.length > 3800)
    throw new Error(
      "The LinkedIn authorization is too large for secure selection.",
    );
  return sealed;
}

export function readLinkedInPagesSession(input: {
  sealed: string;
  key: string;
  now?: Date;
}): LinkedInPagesSession {
  const session = sessionSchema.parse(JSON.parse(openSecret(input)) as unknown);
  if (session.expiresAtMs <= (input.now ?? new Date()).getTime())
    throw new Error("LinkedIn Page selection expired.");
  return session;
}
