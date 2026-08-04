import { redirect } from "next/navigation";
import { MarketingContentQueue } from "@/components/marketing/MarketingContentQueue";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { listMarketingContentItems } from "@/db/repositories/marketing-content.repository";
import { can } from "@/lib/policies/workspace-policy";
export default async function MarketingContentPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "approveMarketingContent"))
    redirect("/app/access-denied");
  const items = await listMarketingContentItems({
    workspaceId: context.activeMembership.workspaceId,
  });
  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Marketing Studio
        </p>
        <h1 className="text-2xl font-semibold">Content review</h1>
        <p className="text-sm text-muted-foreground">
          Review generated work before it enters the existing Social publishing
          path.
        </p>
      </header>
      <MarketingContentQueue items={items} />
    </div>
  );
}
