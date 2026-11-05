import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { WORKSPACE_CONNECTIONS_PATH } from "@/lib/publishing/connections-navigation";
import { upsertPlatformConnection } from "@/db/commands/platform-connection-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import {
  verifyOAuthState,
  type OAuthStatePayload,
} from "@/lib/publishing/oauth-state";
import {
  createRedirectUri,
  createVideoPublishProvider,
} from "@/lib/publishing/provider-registry";
import { TikTokVideoUploadProvider } from "@/lib/publishing/providers/tiktok-video-upload-provider";
import {
  readTikTokOAuthSession,
  TIKTOK_OAUTH_COOKIE_PATH,
  TIKTOK_OAUTH_SESSION_COOKIE,
} from "@/lib/publishing/tiktok-oauth-session";

const noStore = { "Cache-Control": "private, no-store" };

function redirectWithStatus(baseUrl: string, status: string): NextResponse {
  const target = new URL(WORKSPACE_CONNECTIONS_PATH, baseUrl);
  target.searchParams.set("tiktok", status);
  const response = NextResponse.redirect(target, {
    status: 307,
    headers: noStore,
  });
  response.cookies.set(TIKTOK_OAUTH_SESSION_COOKIE, "", {
    path: TIKTOK_OAUTH_COOKIE_PATH,
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(baseUrl).protocol === "https:",
  });
  return response;
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
    const verification = {
      state,
      secret: web.OAUTH_STATE_SECRET,
      ttlSeconds: web.OAUTH_STATE_TTL_SECONDS,
    };
    let statePayload: OAuthStatePayload;
    let sandbox = false;
    try {
      statePayload = verifyOAuthState({ ...verification, platform: "tiktok" });
    } catch {
      statePayload = verifyOAuthState({
        ...verification,
        platform: "tiktok:sandbox",
      });
      sandbox = true;
    }
    if (
      statePayload.workspaceId !== context.activeMembership.workspaceId ||
      statePayload.userId !== context.user.id
    )
      return redirectWithStatus(web.APP_BASE_URL, "forbidden");
    const sandboxCredentials = sandbox
      ? readTikTokOAuthSession({
          sealed:
            (await cookies()).get(TIKTOK_OAUTH_SESSION_COOKIE)?.value ?? "",
          key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
          state,
          workspaceId: context.activeMembership.workspaceId,
          userId: context.user.id,
        })
      : undefined;
    const provider = sandboxCredentials
      ? new TikTokVideoUploadProvider(sandboxCredentials)
      : createVideoPublishProvider("tiktok");
    const { tokens, account } = await provider.exchangeCode({
      code,
      redirectUri: createRedirectUri("tiktok"),
    });
    const connection = await upsertPlatformConnection({
      workspaceId: context.activeMembership.workspaceId,
      platform: "tiktok",
      account,
      tokens,
      connectedByUserId: context.user.id,
      ...(sandboxCredentials
        ? { tikTokSandboxCredentials: sandboxCredentials }
        : {}),
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
