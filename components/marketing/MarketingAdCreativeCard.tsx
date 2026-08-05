import type { MarketingContentItem } from "@/db/schema";
import { adCreativePayloadSchema } from "@/lib/schemas/marketing-campaign";

export function MarketingAdCreativeCard({
  item,
}: {
  item: MarketingContentItem;
}) {
  const parsed = adCreativePayloadSchema.safeParse(item.structuredPayload);
  if (!parsed.success)
    return (
      <article className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
        This ad variant has an invalid payload.
      </article>
    );
  const ad = parsed.data;
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div className="flex justify-between gap-3">
        <h2 className="font-medium">Variant {ad.variantLabel}</h2>
        <span className="text-xs text-muted-foreground">
          {ad.platform} · {ad.placement}
        </span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Headline</p>
        <p className="font-medium">{ad.headline}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Primary text</p>
        <p className="whitespace-pre-wrap text-sm">{ad.primaryText}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Description</p>
          <p>{ad.description}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CTA</p>
          <p>{ad.cta}</p>
        </div>
      </div>
    </article>
  );
}
