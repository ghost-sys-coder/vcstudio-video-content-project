"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { upsertPlatformConnection } from "@/db/commands/platform-connection-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  FACEBOOK_OAUTH_SESSION_COOKIE,
  readFacebookOAuthSession,
  type FacebookOAuthSession,
} from "@/lib/publishing/facebook-oauth-session";
import {
  FacebookVideoPublishProvider,
  type FacebookPage,
} from "@/lib/publishing/providers/facebook-video-publish-provider";

const selectionSchema = z.object({ pageId: z.string().min(1).max(128) });

export async function connectFacebookPageAction(
  formData: FormData,
): Promise<void> {
  const parsed = selectionSchema.safeParse({ pageId: formData.get("pageId") });
  if (!parsed.success) redirect("/app/settings/workspace?facebook=invalid");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/app/settings/workspace?facebook=forbidden");
  requireCapability(context.activeMembership.role, "manageSettings");
  const environment = getPublishingEnvironment();
  const cookieStore = await cookies();
  const sealed = cookieStore.get(FACEBOOK_OAUTH_SESSION_COOKIE)?.value;
  if (!sealed) redirect("/app/settings/workspace?facebook=expired");
  let session: FacebookOAuthSession;
  let pages: FacebookPage[];
  try {
    session = readFacebookOAuthSession({
      sealed,
      key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    });
    const provider = new FacebookVideoPublishProvider({
      apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
    });
    pages = await provider.listPages(session.userAccessToken);
  } catch {
    redirect("/app/settings/workspace?facebook=failed");
  }
  if (
    session.workspaceId !== context.activeMembership.workspaceId ||
    session.userId !== context.user.id
  )
    redirect("/app/settings/workspace?facebook=forbidden");
  const page = pages.find(
    (item) => item.externalAccountId === parsed.data.pageId,
  );
  if (!page) redirect("/app/settings/workspace?facebook=invalid");
  try {
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
    redirect("/app/settings/workspace?facebook=failed");
  }
  redirect("/app/settings/workspace?facebook=connected");
}
