import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import {
  createFacebookOAuthSession,
  FACEBOOK_OAUTH_SESSION_COOKIE,
} from "@/lib/publishing/facebook-oauth-session";
import { verifyOAuthState } from "@/lib/publishing/oauth-state";
import { createRedirectUri } from "@/lib/publishing/provider-registry";
import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";

const noStore = { "Cache-Control": "private, no-store" };

function settingsRedirect(baseUrl: string, status: string): NextResponse {
  const url = new URL("/app/settings/workspace", baseUrl);
  url.searchParams.set("facebook", status);
  return NextResponse.redirect(url, { status: 307, headers: noStore });
}

export async function GET(request: Request) {
  const environment = getPublishingEnvironment();
  const web = getPublishingWebEnvironment();
  const url = new URL(request.url);
  if (url.searchParams.get("error"))
    return settingsRedirect(web.APP_BASE_URL, "cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return settingsRedirect(web.APP_BASE_URL, "invalid");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return settingsRedirect(web.APP_BASE_URL, "forbidden");
  try {
    const payload = verifyOAuthState({
      state,
      secret: web.OAUTH_STATE_SECRET,
      ttlSeconds: web.OAUTH_STATE_TTL_SECONDS,
      platform: "facebook",
    });
    if (
      payload.workspaceId !== context.activeMembership.workspaceId ||
      payload.userId !== context.user.id
    )
      return settingsRedirect(web.APP_BASE_URL, "forbidden");
    const provider = new FacebookVideoPublishProvider({
      apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
      appId: web.FACEBOOK_APP_ID,
      appSecret: web.FACEBOOK_APP_SECRET,
    });
    const tokens = await provider.exchangeUserToken({
      code,
      redirectUri: createRedirectUri("facebook"),
    });
    const expiresAtMs = Math.min(
      tokens.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      Date.now() + web.OAUTH_STATE_TTL_SECONDS * 1000,
    );
    const response = NextResponse.redirect(
      new URL("/app/settings/workspace/facebook/select", web.APP_BASE_URL),
      { status: 307, headers: noStore },
    );
    response.cookies.set(
      FACEBOOK_OAUTH_SESSION_COOKIE,
      createFacebookOAuthSession(
        {
          workspaceId: context.activeMembership.workspaceId,
          userId: context.user.id,
          userAccessToken: tokens.accessToken,
          scopes: tokens.scopes,
          expiresAtMs,
        },
        environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/app/settings/workspace/facebook",
        maxAge: web.OAUTH_STATE_TTL_SECONDS,
      },
    );
    return response;
  } catch {
    return settingsRedirect(web.APP_BASE_URL, "failed");
  }
}
