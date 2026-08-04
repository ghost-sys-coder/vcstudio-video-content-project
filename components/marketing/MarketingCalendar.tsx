import Link from "next/link";
import type { MarketingCalendarItem } from "@/db/repositories/marketing-content.repository";

export function MarketingCalendar({
  items,
}: {
  items: MarketingCalendarItem[];
}) {
  const scheduled = items.filter(
    ({ item, socialScheduledAt }) => item.scheduledFor || socialScheduledAt,
  );
  if (scheduled.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No marketing content has a schedule or Social handoff yet.
      </div>
    );
  return (
    <div className="space-y-3">
      {scheduled.map(({ item, socialStatus, socialScheduledAt }) => (
        <Link
          className="flex items-center justify-between rounded-xl border p-4"
          href={`/app/marketing/content/${item.id}`}
          key={item.id}
        >
          <span>
            <span className="block font-medium">{item.title}</span>
            <span className="text-sm text-muted-foreground">
              {item.socialPostId
                ? `Social: ${socialStatus ?? "draft"} — schedule is authoritative`
                : "Intent only — not scheduled in Social"}
            </span>
          </span>
          <span className="text-sm">
            {(socialScheduledAt ?? item.scheduledFor)?.toLocaleString() ??
              "Unscheduled"}
          </span>
        </Link>
      ))}
    </div>
  );
}
