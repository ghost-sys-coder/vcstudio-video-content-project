import Link from "next/link";
import { Clock3Icon } from "lucide-react";
import type { MarketingCalendarEntry } from "@/lib/marketing/calendar/marketing-calendar-grid";

const STATUS_LABELS = {
  draft: "DRAFT",
  scheduled: "SCHEDULED",
  publishing: "PUBLISHING",
  published: "PUBLISHED",
  partially_failed: "PARTIAL",
  failed: "FAILED",
  cancelled: "CANCELLED",
  intent: "INTENT ONLY",
} as const;

export function MarketingCalendarPostCard({
  entry,
}: {
  entry: MarketingCalendarEntry;
}) {
  const href =
    entry.kind === "social_post"
      ? `/app/marketing/publish/${entry.id}`
      : `/app/marketing/content/${entry.id}`;
  const scheduled = entry.status === "scheduled";
  const published = entry.status === "published";

  return (
    <Link
      className="group relative block min-h-24 overflow-hidden rounded-xl bg-[#0b1f25] text-white shadow-sm ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      href={href}
    >
      {entry.mediaPreviewUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-75 transition group-hover:scale-[1.03]"
          style={{
            backgroundImage: `url(${JSON.stringify(entry.mediaPreviewUrl).slice(1, -1)})`,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,255,45,0.28),transparent_55%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      <div className="relative flex min-h-24 flex-col justify-between gap-4 p-2.5">
        <span
          className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
            published
              ? "bg-emerald-400 text-emerald-950"
              : scheduled
                ? "bg-blue-500 text-white"
                : "bg-white/85 text-slate-900"
          }`}
        >
          {STATUS_LABELS[entry.status]}
        </span>
        <div>
          <p className="line-clamp-2 text-xs font-semibold">{entry.title}</p>
          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-white/75">
            <span className="flex items-center gap-1">
              <Clock3Icon className="size-3" />
              {new Date(entry.occursAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {entry.platforms.length > 0 ? (
              <span className="truncate">
                {Array.from(
                  new Set(entry.platforms.map((platform) => platform.label)),
                ).join(" · ")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
