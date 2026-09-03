import type { MarketingContentItem } from "@/db/schema";
import { MarketingContentCard } from "@/components/marketing/MarketingContentCard";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
export function MarketingContentQueue({
  items,
  mediaByContentItemId,
  accountByDestinationId = {},
  emptyMessage = "No marketing content yet. Create a draft from Chat and it will appear here for review.",
}: {
  items: MarketingContentItem[];
  mediaByContentItemId: Record<string, MediaAssetView[]>;
  accountByDestinationId?: Record<string, string>;
  emptyMessage?: string;
}) {
  if (items.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {items.map((item) => (
        <MarketingContentCard
          accountName={
            item.campaignDestinationId
              ? accountByDestinationId[item.campaignDestinationId]
              : undefined
          }
          item={item}
          key={item.id}
          media={mediaByContentItemId[item.id] ?? []}
        />
      ))}
    </div>
  );
}
