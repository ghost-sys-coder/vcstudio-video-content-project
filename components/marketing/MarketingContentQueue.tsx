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
  const groups = new Map<string, MarketingContentItem[]>();
  for (const item of items) {
    const conceptKey = item.structuredPayload?.conceptKey;
    const key = typeof conceptKey === "string" ? conceptKey : item.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {[...groups.entries()].map(([conceptKey, variants]) => (
        <section className="contents" key={conceptKey}>
          <header className="mt-2 lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Content concept
            </p>
            <h2 className="font-semibold">
              {variants[0]?.title ?? "Campaign content"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {variants.length} account-specific{" "}
              {variants.length === 1 ? "version" : "versions"}. Review each
              caption independently.
            </p>
          </header>
          <div className="contents">
            {variants.map((item) => (
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
        </section>
      ))}
    </div>
  );
}
