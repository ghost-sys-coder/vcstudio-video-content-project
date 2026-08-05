import { retryCampaignAutomationAction } from "@/app/(authenticated)/app/marketing/campaigns/actions";
import { Button } from "@/components/ui/button";
import { CampaignAutomationPoller } from "@/components/marketing/CampaignAutomationPoller";
import type { MarketingCampaign } from "@/db/schema";

export function CampaignAutomationStatus({
  campaign,
}: {
  campaign: MarketingCampaign;
}) {
  const active = ["pending", "researching", "generating"].includes(
    campaign.automationStatus,
  );
  return (
    <section className="rounded-xl border p-4">
      {active ? <CampaignAutomationPoller /> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Automated content</h2>
          <p className="text-sm text-muted-foreground">
            {active
              ? "Research and generation are running in the background."
              : campaign.automationStatus === "completed"
                ? "Campaign drafts are ready in the Content and Ads tabs for owner/editor review."
                : "Campaign automation needs attention."}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {campaign.automationStatus}
        </span>
      </div>
      {campaign.automationError ? (
        <p className="mt-3 text-sm text-destructive">
          {campaign.automationError}
        </p>
      ) : null}
      {campaign.automationStatus === "failed" ? (
        <form action={retryCampaignAutomationAction} className="mt-3">
          <input name="campaignId" type="hidden" value={campaign.id} />
          <Button size="sm" type="submit">
            Try automation again
          </Button>
        </form>
      ) : null}
    </section>
  );
}
