import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";
import { createRedirectUri } from "@/lib/publishing/provider-registry";
import { createPlatformOAuthProvider } from "@/lib/publishing/social-post-registry";

const PLATFORM = "twitter" as const;
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Start the X OAuth flow.
 *
 * Routed under `/api/x/` while the platform is stored as `twitter`: the redirect
 * URI is registered in X's developer console and a mismatch is rejected at the
 * consent screen. `createRedirectUri` owns that mapping, so this route and the
 * console stay in agreement without either guessing.
 *
 * Gated by `ENABLE_SOCIAL_POSTING` rather than `ENABLE_VIDEO_PUBLISHING`,
 * because X is a post destination only.
 */
export async function GET() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return new NextResponse(null, { status: 403, headers: noStore });

  // Connecting an account is a workspace-level change, not a read.
  if (!can(context.activeMembership.role, "manageSettings"))
    return new NextResponse(null, { status: 403, headers: noStore });

  const environment = getPublishingEnvironment();
  const webEnvironment = getPublishingWebEnvironment();
  if (!environment.ENABLE_SOCIAL_POSTING)
    return new NextResponse(null, { status: 404, headers: noStore });

  try {
    const provider = createPlatformOAuthProvider(PLATFORM);
    const authorizationUrl = provider.createAuthorizationUrl({
      redirectUri: createRedirectUri(PLATFORM),
      state: createOAuthState({
        workspaceId: context.activeMembership.workspaceId,
        userId: context.user.id,
        platform: PLATFORM,
        secret: webEnvironment.OAUTH_STATE_SECRET,
      }),
    });
    const response = NextResponse.redirect(authorizationUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse(null, { status: 500, headers: noStore });
  }
}
