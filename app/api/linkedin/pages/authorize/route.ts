import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";
import { createLinkedInPagesProvider } from "@/lib/publishing/social-post-registry";
import {
  LINKEDIN_PAGES_CALLBACK_PATH,
  LINKEDIN_PAGES_STATE_PLATFORM,
  linkedInPagesResultPath,
} from "@/lib/publishing/linkedin-pages-navigation";
import {
  LINKEDIN_PAGES_STATE_COOKIE,
  LINKEDIN_PAGES_STATE_COOKIE_OPTIONS,
} from "@/lib/publishing/linkedin-pages-session";

const noStore = { "Cache-Control": "private, no-store" };
export async function GET() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return new NextResponse(null, { status: 403, headers: noStore });
  if (!getPublishingEnvironment().ENABLE_SOCIAL_POSTING)
    return new NextResponse(null, { status: 404, headers: noStore });
  const web = getPublishingWebEnvironment();
  try {
    const state = createOAuthState({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      platform: LINKEDIN_PAGES_STATE_PLATFORM,
      secret: web.OAUTH_STATE_SECRET,
    });
    const url = createLinkedInPagesProvider().createAuthorizationUrl({
      state,
      redirectUri: new URL(
        LINKEDIN_PAGES_CALLBACK_PATH,
        web.APP_BASE_URL,
      ).toString(),
    });
    const response = NextResponse.redirect(url, {
      status: 307,
      headers: noStore,
    });
    response.cookies.set(LINKEDIN_PAGES_STATE_COOKIE, state, {
      ...LINKEDIN_PAGES_STATE_COOKIE_OPTIONS,
      maxAge: web.OAUTH_STATE_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL(linkedInPagesResultPath("failed"), web.APP_BASE_URL),
      { status: 307, headers: noStore },
    );
  }
}
