import { NextResponse } from "next/server";
import { upsertGoogleBusinessConnection } from "@/db/commands/google-business-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingWebEnvironment } from "@/lib/env/server";
import { exchangeGoogleBusinessCode } from "@/lib/marketing/integrations/google-business-provider";
import { syncGoogleBusiness } from "@/lib/marketing/integrations/sync-google-business";
import { can } from "@/lib/policies/workspace-policy";
import { verifyOAuthState } from "@/lib/publishing/oauth-state";

function redirectWithStatus(baseUrl: string, status: string) {
  const target = new URL("/app/marketing/integrations", baseUrl);
  target.searchParams.set("googleBusiness", status);
  return NextResponse.redirect(target, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const webEnvironment = getPublishingWebEnvironment();
  const url = new URL(request.url);
  if (url.searchParams.get("error"))
    return redirectWithStatus(webEnvironment.APP_BASE_URL, "cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state)
    return redirectWithStatus(webEnvironment.APP_BASE_URL, "invalid");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return redirectWithStatus(webEnvironment.APP_BASE_URL, "forbidden");
  try {
    const payload = verifyOAuthState({
      state,
      secret: webEnvironment.OAUTH_STATE_SECRET,
      ttlSeconds: webEnvironment.OAUTH_STATE_TTL_SECONDS,
      platform: "google_business",
    });
    if (
      payload.workspaceId !== context.activeMembership.workspaceId ||
      payload.userId !== context.user.id
    )
      return redirectWithStatus(webEnvironment.APP_BASE_URL, "forbidden");
    const tokens = await exchangeGoogleBusinessCode(code);
    const connection = await upsertGoogleBusinessConnection({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      tokens,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "google_business_connected",
      targetType: "google_business_connection",
      targetId: connection.id,
    });
    await syncGoogleBusiness({
      workspaceId: context.activeMembership.workspaceId,
    });
    return redirectWithStatus(webEnvironment.APP_BASE_URL, "connected");
  } catch {
    return redirectWithStatus(webEnvironment.APP_BASE_URL, "failed");
  }
}
