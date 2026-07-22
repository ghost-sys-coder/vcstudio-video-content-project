import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FacebookPageSelector } from "@/components/publish/FacebookPageSelector";
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
import { connectFacebookPageAction } from "./actions";

export default async function FacebookPageSelectionPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/app/settings/workspace?facebook=forbidden");
  requireCapability(context.activeMembership.role, "manageSettings");
  const environment = getPublishingEnvironment();
  const sealed = (await cookies()).get(FACEBOOK_OAUTH_SESSION_COOKIE)?.value;
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
  return (
    <FacebookPageSelector action={connectFacebookPageAction} pages={pages} />
  );
}
