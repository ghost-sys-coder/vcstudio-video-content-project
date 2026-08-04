import Link from "next/link";
import type { MarketingContentItem } from "@/db/schema";
import { MarketingContentStatusBadge } from "@/components/marketing/MarketingContentStatusBadge";
export function MarketingContentCard({ item }: { item: MarketingContentItem }) {
  return (
    <Link
      className="block rounded-xl border p-4 transition-colors hover:bg-accent/40"
      href={`/app/marketing/content/${item.id}`}
    >
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
        {item.platform ?? "No platform"} · {item.kind.replaceAll("_", " ")}
      </p>
    </Link>
  );
}
