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
    const provider = createVideoPublishProvider("tiktok");
    return NextResponse.redirect(
      provider.createAuthorizationUrl({
        redirectUri: createRedirectUri("tiktok"),
        state: createOAuthState({
          workspaceId: context.activeMembership.workspaceId,
          userId: context.user.id,
          platform: "tiktok",
          secret: web.OAUTH_STATE_SECRET,
        }),
      }),
      { status: 307, headers: noStore },
    );
  } catch {
    return new NextResponse(null, { status: 500, headers: noStore });
  }
}
