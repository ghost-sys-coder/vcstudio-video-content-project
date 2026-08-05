import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MarketingContentMediaReview({
  assets,
  expectsGraphic,
}: {
  assets: MediaAssetView[];
  expectsGraphic: boolean;
}) {
  if (assets.length === 0)
    return expectsGraphic ? (
      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="font-medium">Generated graphic unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The image attachment could not be loaded. Do not approve this item;
          generate the graphic again.
        </p>
      </section>
    ) : null;

  return (
    <section className="space-y-3">
      <h2 className="font-medium">
        {expectsGraphic ? "Generated graphic" : "Attached media"}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {assets.map((asset) => (
          <figure className="space-y-2" key={asset.id}>
            <MediaAssetPreview
              asset={asset}
              className="flex min-h-80 items-center justify-center overflow-hidden rounded-xl border bg-muted"
            />
            <figcaption className="text-sm text-muted-foreground">
              {asset.title}
              {asset.width && asset.height
                ? ` · ${asset.width} × ${asset.height}`
                : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
