import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import type {
  PlatformAccount,
  PlatformOAuthProvider,
  PlatformTokens,
} from "@/lib/publishing/platform-oauth-provider";
import { LinkedInOAuthClient } from "@/lib/publishing/providers/linkedin-oauth-client";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const userInfoSchema = z.object({
  sub: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  name: z.string().optional(),
});

/** Existing personal-profile app; the Pages app never requests OpenID scopes. */
export class LinkedInOAuthProvider
  extends LinkedInOAuthClient
  implements PlatformOAuthProvider
{
  readonly platform: ContentPlatform = "linkedin";
  readonly accountLabel = "LinkedIn profile";

  constructor(input: { clientId: string; clientSecret: string }) {
    super({ ...input, scopes: ["openid", "profile", "w_member_social"] });
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    const tokens = await this.exchangeTokens(input);
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const parsed = userInfoSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      throw new PublishProviderError({
        category: "provider_error",
        safeMessage: "The LinkedIn profile could not be read.",
        retriable: response.status >= 500,
        mayHavePublished: false,
      });
    return {
      tokens,
      account: {
        externalAccountId: parsed.data.sub,
        externalAccountName: parsed.data.name ?? "LinkedIn member",
        externalAccountUrl: "https://www.linkedin.com/feed/",
      },
    };
  }
}
