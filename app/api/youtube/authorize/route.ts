import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";
import {
  createRedirectUri,
  createVideoPublishProvider,
} from "@/lib/publishing/provider-registry";

const PLATFORM = "youtube" as const;
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Start the YouTube OAuth flow. Redirects the browser to Google's consent
 * screen carrying a signed, expiring `state` bound to this workspace and user.
 *
 * The redirect URI is derived from `APP_BASE_URL` and must exactly match one
 * registered on the OAuth client, so it is never taken from the request.
 */
export async function GET() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return new NextResponse(null, { status: 403, headers: noStore });

  // Connecting an account is a workspace-level change, not a read.
  if (!can(context.activeMembership.role, "mutateWorkspaceData"))
    return new NextResponse(null, { status: 403, headers: noStore });

  const environment = getPublishingEnvironment();
  const webEnvironment = getPublishingWebEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    return new NextResponse(null, { status: 404, headers: noStore });

  try {
    const provider = createVideoPublishProvider(PLATFORM);
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
