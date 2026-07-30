"use client";

import { useMemo } from "react";
import { SocialPostRow } from "@/components/social/SocialPostRow";
import { groupPostsByDay } from "@/lib/social/schedule-calendar";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

/**
 * An agenda of what is going out and what already has, grouped by local day.
 *
 * Deliberately an agenda list rather than a month grid: a workspace posting a
 * few times a week gets a mostly-empty grid, and the useful question — "what is
 * queued next, and did anything fail?" — reads better as a list.
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
          <h2 className="mb-2 text-sm font-medium">
            <time dateTime={day.date}>
              {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </time>
          </h2>
          <ul className="space-y-2">
            {day.posts.map((post) => (
              <SocialPostRow key={post.id} post={post} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
