"use client";

import { useMemo } from "react";
import { SocialPostRow } from "@/components/social/SocialPostRow";
import { groupPostsByDay } from "@/lib/social/schedule-calendar";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

/**
 * Post cards in responsive grids, grouped by the viewer's local calendar day.
 *
 * Grouping runs in the browser because the day boundaries are the **viewer's**,
 * and the server has no reliable way to know their timezone.
 */
export function ScheduleCalendar({
  posts,
}: {
  posts: SocialPostSummaryView[];
}) {
  const days = useMemo(() => groupPostsByDay({ posts }), [posts]);

  if (days.length === 0)
    return (
      <p className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Nothing scheduled or published yet. Schedule a post from the composer
        and it will appear here.
      </p>
    );

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.date}>
          <h2 className="mb-2 px-0.5 text-sm font-medium">
            <time dateTime={day.date}>
              {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </time>
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4">
            {day.posts.map((post) => (
              <SocialPostRow key={post.id} post={post} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
