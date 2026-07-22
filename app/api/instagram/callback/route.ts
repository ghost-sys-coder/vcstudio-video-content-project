import { NextResponse } from "next/server";
import { upsertPlatformConnection } from "@/db/commands/platform-connection-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { verifyOAuthState } from "@/lib/publishing/oauth-state";
import { createRedirectUri } from "@/lib/publishing/provider-registry";
import { InstagramVideoPublishProvider } from "@/lib/publishing/providers/instagram-video-publish-provider";

const noStore = { "Cache-Control": "private, no-store" };

function redirectWithStatus(baseUrl: string, status: string): NextResponse {
  const target = new URL("/app/settings/workspace", baseUrl);
  target.searchParams.set("instagram", status);
  return NextResponse.redirect(target, { status: 307, headers: noStore });
}

export async function GET(request: Request) {
  const environment = getPublishingEnvironment();
  const web = getPublishingWebEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    return new NextResponse(null, { status: 404, headers: noStore });
  const url = new URL(request.url);
  if (url.searchParams.get("error"))
    return redirectWithStatus(web.APP_BASE_URL, "cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirectWithStatus(web.APP_BASE_URL, "invalid");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return redirectWithStatus(web.APP_BASE_URL, "forbidden");
  try {
    const statePayload = verifyOAuthState({
      state,
      secret: web.OAUTH_STATE_SECRET,
      ttlSeconds: web.OAUTH_STATE_TTL_SECONDS,
      platform: "instagram",
    });
    if (
      statePayload.workspaceId !== context.activeMembership.workspaceId ||
      statePayload.userId !== context.user.id
    )
      return redirectWithStatus(web.APP_BASE_URL, "forbidden");
    const provider = new InstagramVideoPublishProvider({
      apiVersion: environment.INSTAGRAM_GRAPH_API_VERSION,
      appId: web.INSTAGRAM_APP_ID,
      appSecret: web.INSTAGRAM_APP_SECRET,
    });
    const { tokens, account } = await provider.exchangeCode({
      code,
      redirectUri: createRedirectUri("instagram"),
    });
    const connection = await upsertPlatformConnection({
      workspaceId: context.activeMembership.workspaceId,
      platform: "instagram",
      account,
      tokens,
      connectedByUserId: context.user.id,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "platform_connected",
      targetType: "platform_connection",
      targetId: connection.id,
    });
    return redirectWithStatus(web.APP_BASE_URL, "connected");
  } catch {
    return redirectWithStatus(web.APP_BASE_URL, "failed");
  }
}
