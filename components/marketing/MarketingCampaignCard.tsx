import Link from "next/link";
import type { MarketingCampaign } from "@/db/schema";

export function MarketingCampaignCard({
  campaign,
}: {
  campaign: MarketingCampaign;
}) {
  return (
    <Link
      className="block rounded-xl border p-4 transition-colors hover:bg-accent/40"
      href={`/app/marketing/campaigns/${campaign.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-medium">{campaign.name}</h2>
        <span className="text-xs text-muted-foreground">{campaign.status}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {campaign.keyMessage ||
          campaign.briefPlainText ||
          "No campaign brief yet."}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {campaign.objective} · {campaign.trafficType} ·{" "}
        {campaign.platforms.join(", ")}
      </p>
    </Link>
  );
}
