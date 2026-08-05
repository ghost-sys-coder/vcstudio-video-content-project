import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import type { MarketingContentKind, MarketingContentStatus } from "@/db/schema";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MarketingContentMediaReview({
  assets,
  body,
  expectsGraphic,
  kind,
  platform,
  status,
  title,
}: {
  assets: MediaAssetView[];
  body: string;
  expectsGraphic: boolean;
  kind: MarketingContentKind;
  platform: string | null;
  status: MarketingContentStatus;
  title: string;
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
          <figure
            className="relative isolate min-h-80 overflow-hidden rounded-xl border bg-muted"
            key={asset.id}
          >
            <MediaAssetPreview
              asset={asset}
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
            />
            <figcaption
              className={`pointer-events-none absolute inset-x-0 z-10 p-5 text-white ${asset.kind === "video" ? "top-0 bg-gradient-to-b from-black/85 via-black/55 to-transparent pb-16" : "bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent pt-20"}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-white/80">
                <span>{kind.replaceAll("_", " ")}</span>
                <span aria-hidden="true">·</span>
                <span>{platform ?? "No platform"}</span>
                <span aria-hidden="true">·</span>
                <span>{status.replaceAll("_", " ")}</span>
                {asset.width && asset.height ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {asset.width} × {asset.height}
                    </span>
                  </>
                ) : null}
              </div>
              <h3 className="max-w-2xl text-xl font-semibold leading-tight text-balance">
                {title}
              </h3>
              {body.trim() !== "" ? (
                <p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/85">
                  {body}
                </p>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
