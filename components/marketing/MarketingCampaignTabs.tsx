import Link from "next/link";
import type { MarketingCampaign } from "@/db/schema";

export function MarketingCampaignTabs({
  campaign,
}: {
  campaign: MarketingCampaign;
}) {
  const tabs = [
    {
      href: `/app/marketing/campaigns/${campaign.id}`,
      label: "Brief",
      show: true,
    },
    {
      href: `/app/marketing/campaigns/${campaign.id}/content`,
      label: "Content",
      show: campaign.trafficType !== "paid",
    },
    {
      href: `/app/marketing/campaigns/${campaign.id}/ads`,
      label: "Ads",
      show: campaign.trafficType !== "organic",
    },
    {
      href: `/app/marketing/campaigns/${campaign.id}/settings`,
      label: "Settings",
      show: true,
    },
  ];
  return (
    <nav aria-label="Campaign">
      <ul className="flex flex-wrap gap-4 border-b pb-3">
        {tabs
          .filter((tab) => tab.show)
          .map((tab) => (
            <li key={tab.href}>
              <Link
                className="text-sm font-medium hover:underline"
                href={tab.href}
              >
                {tab.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
