import { redirect } from "next/navigation";
import { MarketingWeeklyDigestList } from "@/components/marketing/digests/MarketingWeeklyDigestList";
import { listMarketingWeeklyDigests } from "@/db/repositories/marketing-weekly-digests.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function MarketingDigestsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  const rows = await listMarketingWeeklyDigests({
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
  });
  return (
    <MarketingWeeklyDigestList
      digests={rows
        .filter((row) => row.digest.status === "ready" && row.digest.snapshot)
        .map((row) => ({
          id: row.digest.id,
          weekStart: String(row.digest.weekStart),
          weekEnd: String(row.digest.weekEnd),
          snapshot: row.digest.snapshot!,
          acknowledged: Boolean(row.acknowledgedAt),
        }))}
    />
  );
}
