import Link from "next/link";
import { PlatformMarkIcon } from "@/components/brand/PlatformMarkIcon";
import { MarketingContentStatusBadge } from "@/components/marketing/MarketingContentStatusBadge";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import type { MarketingContentItem } from "@/db/schema";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MarketingContentCard({
  item,
  media,
  accountName,
}: {
  item: MarketingContentItem;
  media: MediaAssetView[];
  accountName?: string;
}) {
  const asset = media[0];
  const platformOverlay = item.platform ? (
    <span
      aria-label={item.platform}
      className={`absolute left-3 top-3 z-20 grid size-9 place-items-center rounded-lg border shadow-sm ${asset ? "border-white/20 bg-black/65 text-white backdrop-blur-sm" : "bg-background text-foreground"}`}
      title={item.platform}
    >
      <PlatformMarkIcon className="size-4" platform={item.platform} />
    </span>
  ) : null;

  if (asset)
    return (
      <Link
        aria-label={`Review ${item.title || item.kind.replaceAll("_", " ")}`}
        className="group relative isolate min-h-72 overflow-hidden rounded-xl border bg-muted outline-none transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        href={`/app/marketing/content/${item.id}`}
      >
        {platformOverlay}
        <MediaAssetPreview
          asset={asset}
          className="absolute inset-0 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.015]"
          controls={false}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 p-5 text-white ${asset.kind === "video" ? "top-0 bg-gradient-to-b from-black/85 via-black/55 to-transparent pb-16" : "bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent pt-20"}`}
        >
          <p className="mb-2 text-xs font-medium text-white/80">
            {accountName ?? item.platform ?? "No platform"} ·{" "}
            {item.kind.replaceAll("_", " ")} ·{" "}
            {item.status.replaceAll("_", " ")}
          </p>
          <h2 className="text-lg font-semibold leading-tight text-balance">
            {item.title || item.kind.replaceAll("_", " ")}
          </h2>
          {item.bodyPlainText.trim() !== "" ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/85">
              {item.bodyPlainText}
            </p>
          ) : null}
        </div>
      </Link>
    );

  return (
    <Link
      className="relative block rounded-xl border p-4 pt-16 transition-colors hover:bg-accent/40"
      href={`/app/marketing/content/${item.id}`}
    >
      {platformOverlay}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {item.title || item.kind.replaceAll("_", " ")}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {item.bodyPlainText}
          </p>
        </div>
        <MarketingContentStatusBadge status={item.status} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {accountName ?? item.platform ?? "No platform"} ·{" "}
        {item.kind.replaceAll("_", " ")}
      </p>
      {item.scheduledFor ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Planned for {item.scheduledFor.toLocaleString()} · confirm the exact
          time in Social
        </p>
      ) : null}
    </Link>
  );
}
