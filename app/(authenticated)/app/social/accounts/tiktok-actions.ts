"use server";

import { cookies } from "next/headers";
import { tikTokSandboxCredentialsSchema } from "@studio/contracts/publishing";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { createOAuthState } from "@/lib/publishing/oauth-state";
import { createRedirectUri } from "@/lib/publishing/provider-registry";
import { TikTokVideoUploadProvider } from "@/lib/publishing/providers/tiktok-video-upload-provider";
import {
  createTikTokOAuthSession,
  TIKTOK_OAUTH_COOKIE_PATH,
  TIKTOK_OAUTH_SESSION_COOKIE,
} from "@/lib/publishing/tiktok-oauth-session";

export async function loadTikTokConnectionSetupAction(): Promise<
  { ok: true; redirectUri: string } | { ok: false; error: string }
> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return {
      ok: false,
      error: "Only workspace owners can connect TikTok accounts.",
    };
  if (!getPublishingEnvironment().ENABLE_VIDEO_PUBLISHING)
    return { ok: false, error: "TikTok connections are currently paused." };
  try {
    return { ok: true, redirectUri: createRedirectUri("tiktok") };
  } catch {
    return {
      ok: false,
      error: "TikTok connection setup is unavailable. Please try again.",
    };
  }
}

export async function startTikTokSandboxConnectionAction(
  form: FormData,
): Promise<
  { ok: true; authorizationUrl: string } | { ok: false; error: string }
> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    return {
      ok: false,
      error: "Only workspace owners can connect TikTok accounts.",
    };
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    return { ok: false, error: "TikTok connections are currently paused." };
  const parsed = tikTokSandboxCredentialsSchema.safeParse({
    clientKey: form.get("clientKey"),
    clientSecret: form.get("clientSecret"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error:
        "Enter a valid sandbox Client Key and Client Secret from TikTok for Developers.",
    };
  try {
    const web = getPublishingWebEnvironment();
    const workspaceId = context.activeMembership.workspaceId;
    // Purpose-bound state prevents falling back to production credentials if the cookie is lost.
    const state = createOAuthState({
      workspaceId,
      userId: context.user.id,
      platform: "tiktok:sandbox",
      secret: web.OAUTH_STATE_SECRET,
    });
    const ttlSeconds = Math.min(web.OAUTH_STATE_TTL_SECONDS, 600);
    const cookieStore = await cookies();
    cookieStore.set(
      TIKTOK_OAUTH_SESSION_COOKIE,
      createTikTokOAuthSession(
        {
          ...parsed.data,
          workspaceId,
          userId: context.user.id,
          state,
          expiresAtMs: Date.now() + ttlSeconds * 1000,
        },
        environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
      ),
      {
        httpOnly: true,
        secure: new URL(web.APP_BASE_URL).protocol === "https:",
        sameSite: "lax",
        path: TIKTOK_OAUTH_COOKIE_PATH,
        maxAge: ttlSeconds,
      },
    );
    return {
      ok: true,
      authorizationUrl: new TikTokVideoUploadProvider(
        parsed.data,
      ).createAuthorizationUrl({
        redirectUri: createRedirectUri("tiktok"),
        state,
      }),
    };
  } catch {
    return {
      ok: false,
      error: "TikTok authorization could not start. Please try again.",
    };
  }
}
