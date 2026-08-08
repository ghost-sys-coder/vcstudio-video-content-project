import { MarketingCalendarPostCard } from "@/components/marketing/MarketingCalendarPostCard";
import type { MarketingCalendarDay } from "@/lib/marketing/calendar/marketing-calendar-grid";

export function MarketingCalendarDayCell({
  day,
}: {
  day: MarketingCalendarDay;
}) {
  return (
    <div
      className={`min-h-40 border-r border-b p-2 last:border-r-0 ${day.inCurrentMonth ? "bg-background/65" : "bg-muted/25 text-muted-foreground"}`}
    >
      <time
        className={`mb-2 flex size-7 items-center justify-center rounded-full text-xs font-medium ${day.isToday ? "bg-primary text-primary-foreground" : ""}`}
        dateTime={day.key}
      >
        {day.dayNumber}
      </time>
      <div className="space-y-2">
        {day.entries.map((entry) => (
          <MarketingCalendarPostCard
            entry={entry}
            key={`${entry.kind}:${entry.id}`}
          />
        ))}
      </div>
    </div>
  );
}
