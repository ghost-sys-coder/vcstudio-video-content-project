import { notFound, redirect } from "next/navigation";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";

/**
 * Gates the whole Marketing Studio segment.
 *
 * The flag is checked here rather than only in the sidebar, because hiding a
 * link is not a feature flag — the routes stay reachable by URL. A disabled
 * feature answers `notFound()` rather than a redirect, so an unreleased segment
 * is indistinguishable from one that does not exist.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getMarketingEnvironment().ENABLE_MARKETING_STUDIO) notFound();

  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "useMarketingChat"))
    redirect("/app/access-denied");

  return <>{children}</>;
}
