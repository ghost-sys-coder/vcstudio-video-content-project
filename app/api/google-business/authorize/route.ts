import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingWebEnvironment } from "@/lib/env/server";
import { createGoogleBusinessAuthorizationUrl } from "@/lib/marketing/integrations/google-business-provider";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return new NextResponse(null, { status: 403, headers: noStore });
  try {
    const webEnvironment = getPublishingWebEnvironment();
    const state = createOAuthState({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      platform: "google_business",
      secret: webEnvironment.OAUTH_STATE_SECRET,
    });
    return NextResponse.redirect(createGoogleBusinessAuthorizationUrl(state), {
      status: 307,
      headers: noStore,
    });
  } catch {
    return new NextResponse(null, { status: 500, headers: noStore });
  }
}
