"use server";

import { redirect } from "next/navigation";
import {
  facebookPageIdSchema,
  type FacebookPageLookupState,
} from "@studio/contracts/publishing";
import { upsertPlatformConnection } from "@/db/commands/platform-connection-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { FACEBOOK_OAUTH_SESSION_COOKIE } from "@/lib/publishing/facebook-oauth-session";
import { loadFacebookPageSelection } from "@/lib/publishing/facebook-page-selection";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

export async function findFacebookPageAction(
  _previous: FacebookPageLookupState,
  formData: FormData,
): Promise<FacebookPageLookupState> {
  const { session, provider } = await loadFacebookPageSelection();
  const parsed = facebookPageIdSchema.safeParse(formData.get("pageId"));
  if (!parsed.success)
    return { page: null, error: "Enter the numeric Facebook Page ID." };
  try {
    const page = await provider.getPage({
      userAccessToken: session.userAccessToken,
      pageId: parsed.data,
    });
    return {
      page: {
        externalAccountId: page.externalAccountId,
        externalAccountName: page.externalAccountName,
      },
      error: null,
    };
  } catch (error) {
    return {
      page: null,
      error:
        error instanceof PublishProviderError
          ? error.failure.safeMessage
          : "Facebook could not be reached. Your Page ID is still here; try again shortly.",
    };
  }
}

export async function connectFacebookPageAction(
  formData: FormData,
): Promise<void> {
  const parsed = facebookPageIdSchema.safeParse(formData.get("pageId"));
  if (!parsed.success) redirect("/app/social/accounts?facebook=invalid");
  const { context, session, provider, cookieStore } =
    await loadFacebookPageSelection();
  try {
    // Recheck the exact Page on confirmation, including direct-lookup results.
    // A submitted Page name, token, or workspace identifier is never trusted.
    const page = await provider.getPage({
      userAccessToken: session.userAccessToken,
      pageId: parsed.data,
    });
    const connection = await upsertPlatformConnection({
      workspaceId: session.workspaceId,
      platform: "facebook",
      account: page,
      tokens: {
        accessToken: page.pageAccessToken,
        refreshToken: null,
        expiresAt: null,
        scopes: session.scopes,
      },
      connectedByUserId: context.user.id,
    });
    await recordAuditEvent({
      workspaceId: session.workspaceId,
      actorUserId: context.user.id,
      action: "platform_connected",
      targetType: "platform_connection",
      targetId: connection.id,
    });
    cookieStore.delete(FACEBOOK_OAUTH_SESSION_COOKIE);
  } catch {
    redirect("/app/social/accounts?facebook=failed");
  }
  redirect("/app/social/accounts?facebook=connected");
}
