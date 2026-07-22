import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";
import { createRedirectUri } from "@/lib/publishing/provider-registry";
import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return new NextResponse(null, { status: 403, headers: noStore });
  const environment = getPublishingEnvironment();
  const web = getPublishingWebEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    return new NextResponse(null, { status: 404, headers: noStore });
  try {
    const provider = new FacebookVideoPublishProvider({
      apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
      appId: web.FACEBOOK_APP_ID,
      appSecret: web.FACEBOOK_APP_SECRET,
    });
    const url = provider.createAuthorizationUrl({
      redirectUri: createRedirectUri("facebook"),
      state: createOAuthState({
        workspaceId: context.activeMembership.workspaceId,
        userId: context.user.id,
        platform: "facebook",
        secret: web.OAUTH_STATE_SECRET,
      }),
    });
    return NextResponse.redirect(url, { status: 307, headers: noStore });
  } catch {
    return new NextResponse(null, { status: 500, headers: noStore });
  }
}
