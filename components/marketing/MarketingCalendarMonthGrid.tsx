import { MarketingCalendarDayCell } from "@/components/marketing/MarketingCalendarDayCell";
import { MarketingCalendarPostCard } from "@/components/marketing/MarketingCalendarPostCard";
import type { MarketingCalendarDay } from "@/lib/marketing/calendar/marketing-calendar-grid";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MarketingCalendarMonthGrid({
  days,
}: {
  days: MarketingCalendarDay[];
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border bg-background/40 shadow-sm">
      <div className="hidden grid-cols-7 border-b bg-muted/35 md:grid">
        {WEEKDAYS.map((weekday) => (
          <div
            className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            key={weekday}
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-7 md:grid">
        {days.map((day) => (
          <MarketingCalendarDayCell day={day} key={day.key} />
        ))}
      </div>
      <div className="divide-y md:hidden">
        {days
          .filter((day) => day.inCurrentMonth && day.entries.length > 0)
          .map((day) => (
            <section className="space-y-2 p-4" key={day.key}>
              <h2 className="text-sm font-semibold">
                {new Date(`${day.key}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              {day.entries.map((entry) => (
                <MarketingCalendarPostCard
                  entry={entry}
                  key={`${entry.kind}:${entry.id}`}
                />
              ))}
            </section>
          ))}
      </div>
    </div>
  );
}
