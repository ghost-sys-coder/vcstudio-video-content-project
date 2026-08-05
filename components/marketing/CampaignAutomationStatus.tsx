import { startCampaignAutomationAction } from "@/app/(authenticated)/app/marketing/campaigns/actions";
import { Button } from "@/components/ui/button";
import { CampaignAutomationPoller } from "@/components/marketing/CampaignAutomationPoller";
import type { MarketingCampaign } from "@/db/schema";
import { getCampaignAutomationPresentation } from "@/lib/marketing/campaigns/campaign-automation-presentation";
import Link from "next/link";

export function CampaignAutomationStatus({
  campaign,
  contentCount,
}: {
  campaign: MarketingCampaign;
  contentCount: number;
}) {
  const active = ["pending", "researching", "generating"].includes(
    campaign.automationStatus,
  );
  const presentation = getCampaignAutomationPresentation({
    status: campaign.automationStatus,
    completedAt: campaign.automationCompletedAt,
    contentCount,
  });
  return (
    <section className="rounded-xl border p-4">
      {active ? <CampaignAutomationPoller /> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Automated content</h2>
          <p className="text-sm text-muted-foreground">
            {presentation.message}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {presentation.label}
        </span>
      </div>
      {campaign.automationError ? (
        <p className="mt-3 text-sm text-destructive">
          {campaign.automationError}
        </p>
      ) : null}
      <Link
        className="mt-3 inline-block text-sm text-primary hover:underline"
        href="/app/marketing/research"
      >
        View company and competitor research
      </Link>
      {presentation.canStart ? (
        <form action={startCampaignAutomationAction} className="mt-3">
          <input name="campaignId" type="hidden" value={campaign.id} />
          <Button size="sm" type="submit">
            {campaign.automationStatus === "failed"
              ? "Try automation again"
              : "Generate campaign drafts"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
