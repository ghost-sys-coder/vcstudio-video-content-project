import type { MarketingContentItem } from "@/db/schema";
import { MarketingContentCard } from "@/components/marketing/MarketingContentCard";
export function MarketingContentQueue({
  items,
}: {
  items: MarketingContentItem[];
}) {
  if (items.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No marketing content yet. Create a draft from Chat and it will appear
        here for review.
      </div>
    );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <MarketingContentCard item={item} key={item.id} />
      ))}
    </div>
  );
}
