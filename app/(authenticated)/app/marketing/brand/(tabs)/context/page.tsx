import { redirect } from "next/navigation";
import { BrandContextPreview } from "@/components/marketing/BrandContextPreview";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { compileBrandContext } from "@/lib/marketing/brand/compile-brand-context";
import { can } from "@/lib/policies/workspace-policy";

/**
 * Compiles on read rather than reading the last snapshot.
 *
 * The page's job is to answer "what would the studio send right now?", which is
 * the current profile and corpus, not whatever was last frozen for a
 * generation. Compiling is free — no provider call — so there is nothing to
 * save by showing a stale snapshot, and no snapshot row is written here.
 */
export default async function BrandContextPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "manageBrandProfile"))
    redirect("/app/access-denied");

  const compiled = await compileBrandContext({
    workspaceId: context.activeMembership.workspaceId,
  });

  return <BrandContextPreview context={compiled} />;
}
