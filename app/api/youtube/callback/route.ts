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
import {
  createRedirectUri,
  createVideoPublishProvider,
} from "@/lib/publishing/provider-registry";

const PLATFORM = "youtube" as const;
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Redirect back to the workspace connections screen with a short status code.
 * The reason is always one of a fixed set — provider error text is never echoed
 * into a URL, where it would land in browser history and server logs.
 */
function redirectWithStatus(baseUrl: string, status: string): NextResponse {
  const target = new URL("/app/settings/workspace", baseUrl);
  target.searchParams.set("youtube", status);
  const response = NextResponse.redirect(target.toString(), 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const environment = getPublishingEnvironment();
  const webEnvironment = getPublishingWebEnvironment();
  const { APP_BASE_URL } = webEnvironment;
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    return new NextResponse(null, { status: 404, headers: noStore });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // The user declined consent, or Google refused. Not an error worth alarming
  // anyone about — send them back cleanly.
  if (url.searchParams.get("error"))
    return redirectWithStatus(APP_BASE_URL, "cancelled");
  if (!code || !state) return redirectWithStatus(APP_BASE_URL, "invalid");

  // Re-establish the session independently of `state`: the signed payload proves
  // the flow started here, but authorization is still resolved from the real
  // session, never from a value that arrived in the query string.
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return redirectWithStatus(APP_BASE_URL, "forbidden");

  let statePayload;
  try {
    statePayload = verifyOAuthState({
      state,
      secret: webEnvironment.OAUTH_STATE_SECRET,
      ttlSeconds: webEnvironment.OAUTH_STATE_TTL_SECONDS,
      platform: PLATFORM,
    });
  } catch {
    return redirectWithStatus(APP_BASE_URL, "invalid");
  }

  // The signed workspace must match the session's active workspace, so a state
  // minted for one workspace cannot attach a channel to another.
  if (
    statePayload.workspaceId !== context.activeMembership.workspaceId ||
    statePayload.userId !== context.user.id
  )
    return redirectWithStatus(APP_BASE_URL, "forbidden");

  try {
    const provider = createVideoPublishProvider(PLATFORM);
    const { tokens, account } = await provider.exchangeCode({
      code,
      redirectUri: createRedirectUri(PLATFORM),
    });

    const connection = await upsertPlatformConnection({
      workspaceId: context.activeMembership.workspaceId,
      platform: PLATFORM,
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

    return redirectWithStatus(APP_BASE_URL, "connected");
  } catch {
    // Never surface the provider's raw error: it can carry quota project ids and
    // internal hints, and this lands in a URL.
    return redirectWithStatus(APP_BASE_URL, "failed");
  }
}
