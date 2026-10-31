import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { safeEquals } from "@/lib/crypto/secret-box";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { verifyOAuthState } from "@/lib/publishing/oauth-state";
import { createLinkedInPagesProvider } from "@/lib/publishing/social-post-registry";
import {
  LINKEDIN_PAGES_CALLBACK_PATH,
  LINKEDIN_PAGES_SELECTION_PATH,
  LINKEDIN_PAGES_STATE_PLATFORM,
  linkedInPagesResultPath,
} from "@/lib/publishing/linkedin-pages-navigation";
import {
  createLinkedInPagesSession,
  LINKEDIN_PAGES_SESSION_COOKIE,
  LINKEDIN_PAGES_COOKIE_OPTIONS,
  LINKEDIN_PAGES_STATE_COOKIE,
  LINKEDIN_PAGES_STATE_COOKIE_OPTIONS,
} from "@/lib/publishing/linkedin-pages-session";

export async function GET(request: Request) {
  const web = getPublishingWebEnvironment();
  const headers = { "Cache-Control": "private, no-store" };
  function result(status: Parameters<typeof linkedInPagesResultPath>[0]) {
    const response = NextResponse.redirect(
      new URL(linkedInPagesResultPath(status), web.APP_BASE_URL),
      { status: 307, headers },
    );
    response.cookies.set(LINKEDIN_PAGES_STATE_COOKIE, "", {
      ...LINKEDIN_PAGES_STATE_COOKIE_OPTIONS,
      maxAge: 0,
    });
    response.cookies.set(LINKEDIN_PAGES_SESSION_COOKIE, "", {
      ...LINKEDIN_PAGES_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return response;
  }
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return result("forbidden");
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_SOCIAL_POSTING) return result("failed");
  const query = new URL(request.url).searchParams;
  const state = query.get("state");
  const expected = (await cookies()).get(LINKEDIN_PAGES_STATE_COOKIE)?.value;
  if (!state || !expected || !safeEquals(state, expected))
    return result("invalid");
  try {
    const payload = verifyOAuthState({
      state,
      secret: web.OAUTH_STATE_SECRET,
      ttlSeconds: web.OAUTH_STATE_TTL_SECONDS,
      platform: LINKEDIN_PAGES_STATE_PLATFORM,
    });
    if (
      payload.workspaceId !== context.activeMembership.workspaceId ||
      payload.userId !== context.user.id
    )
      return result("forbidden");
    if (query.has("error")) return result("cancelled");
    const code = query.get("code");
    if (!code) return result("invalid");
    const tokens = await createLinkedInPagesProvider().exchangeTokens({
      code,
      redirectUri: new URL(
        LINKEDIN_PAGES_CALLBACK_PATH,
        web.APP_BASE_URL,
      ).toString(),
    });
    const sealed = createLinkedInPagesSession(
      {
        workspaceId: context.activeMembership.workspaceId,
        userId: context.user.id,
        tokens,
        ttlSeconds: web.OAUTH_STATE_TTL_SECONDS,
      },
      environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    );
    const response = NextResponse.redirect(
      new URL(LINKEDIN_PAGES_SELECTION_PATH, web.APP_BASE_URL),
      { status: 307, headers },
    );
    response.cookies.set(LINKEDIN_PAGES_STATE_COOKIE, "", {
      ...LINKEDIN_PAGES_STATE_COOKIE_OPTIONS,
      maxAge: 0,
    });
    response.cookies.set(LINKEDIN_PAGES_SESSION_COOKIE, sealed, {
      ...LINKEDIN_PAGES_COOKIE_OPTIONS,
      maxAge: Math.min(600, web.OAUTH_STATE_TTL_SECONDS),
    });
    return response;
  } catch {
    return result("failed");
  }
}
