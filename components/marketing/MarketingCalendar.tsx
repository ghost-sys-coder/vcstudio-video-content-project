"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { CreatePostButton } from "@/components/social/CreatePostButton";
import { MarketingCalendarMonthGrid } from "@/components/marketing/MarketingCalendarMonthGrid";
import { Button } from "@/components/ui/button";
import {
  buildMarketingCalendarMonth,
  type MarketingCalendarEntry,
} from "@/lib/marketing/calendar/marketing-calendar-grid";

export function MarketingCalendar({
  canCompose,
  entries,
}: {
  canCompose: boolean;
  entries: MarketingCalendarEntry[];
}) {
  const [cursor, setCursor] = useState(() => {
    const nextScheduled = [...entries]
      .filter((entry) => new Date(entry.occursAt).getTime() >= Date.now())
      .sort((left, right) => left.occursAt.localeCompare(right.occursAt))[0];
    return nextScheduled ? new Date(nextScheduled.occursAt) : new Date();
  });
  const days = useMemo(
    () =>
      buildMarketingCalendarMonth({
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        entries,
      }),
    [cursor, entries],
  );

  function moveMonth(offset: number) {
    setCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="min-w-48 text-3xl font-semibold tracking-tight">
            {cursor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h1>
          <Button
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Next month"
            onClick={() => moveMonth(1)}
            size="icon"
            variant="ghost"
          >
            <ChevronRightIcon />
          </Button>
          <Button onClick={() => setCursor(new Date())} variant="outline">
            Today
          </Button>
        </div>
        {canCompose ? (
          <CreatePostButton composerBasePath="/app/marketing/publish" />
        ) : null}
      </header>
      {entries.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed p-12 text-center text-sm text-muted-foreground">
          Upload your first image or video, add its caption, then publish now or
          schedule it for later.
        </div>
      ) : (
        <MarketingCalendarMonthGrid days={days} />
      )}
    </div>
  );
}
