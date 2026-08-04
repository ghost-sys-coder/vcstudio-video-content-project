import { redirect } from "next/navigation";
import { MarketingCalendar } from "@/components/marketing/MarketingCalendar";
import { listMarketingCalendarItems } from "@/db/repositories/marketing-content.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
export default async function MarketingCalendarPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "approveMarketingContent"))
    redirect("/app/access-denied");
  const items = await listMarketingCalendarItems({
    workspaceId: context.activeMembership.workspaceId,
  });
  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Marketing Studio
        </p>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Intent is shown separately from content actually handed to Social.
        </p>
      </header>
      <MarketingCalendar items={items} />
    </div>
  );
}
