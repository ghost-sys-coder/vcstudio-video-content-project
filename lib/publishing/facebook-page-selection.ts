import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  FACEBOOK_OAUTH_SESSION_COOKIE,
  readFacebookOAuthSession,
  type FacebookOAuthSession,
} from "@/lib/publishing/facebook-oauth-session";
import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";

/** Bind the temporary authorization before making any provider request. */
export async function loadFacebookPageSelection() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/app/social/accounts?facebook=forbidden");
  requireCapability(context.activeMembership.role, "manageSettings");
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    redirect("/app/social/accounts?facebook=forbidden");
  const cookieStore = await cookies();
  const sealed = cookieStore.get(FACEBOOK_OAUTH_SESSION_COOKIE)?.value;
  if (!sealed) redirect("/app/social/accounts?facebook=expired");
  let session: FacebookOAuthSession;
  try {
    session = readFacebookOAuthSession({
      sealed,
      key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    });
  } catch {
    redirect("/app/social/accounts?facebook=expired");
  }
  if (
    session.workspaceId !== context.activeMembership.workspaceId ||
    session.userId !== context.user.id
  )
    redirect("/app/social/accounts?facebook=forbidden");
  return {
    context,
    session,
    cookieStore,
    provider: new FacebookVideoPublishProvider({
      apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
      appId: environment.FACEBOOK_APP_ID,
      appSecret: environment.FACEBOOK_APP_SECRET,
    }),
  };
}
