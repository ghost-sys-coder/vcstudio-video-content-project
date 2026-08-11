import { approveAllCampaignContentAction } from "@/app/(authenticated)/app/marketing/campaigns/actions";
import { Button } from "@/components/ui/button";

export function CampaignApproveAllButton({
  campaignId,
  count,
}: {
  campaignId: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <form action={approveAllCampaignContentAction}>
      <input name="campaignId" type="hidden" value={campaignId} />
      <Button type="submit">Approve all {count} awaiting review</Button>
      <p className="mt-2 text-xs text-muted-foreground">
        This approves only items awaiting review. Declined or change-requested
        items remain unchanged, and nothing is scheduled automatically.
      </p>
    </form>
  );
}
