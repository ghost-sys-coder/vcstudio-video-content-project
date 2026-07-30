import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export type CalendarDay = {
  /** `YYYY-MM-DD` in the viewer's own local time. */
  date: string;
  posts: SocialPostSummaryView[];
};

/**
 * Groups posts into local calendar days, oldest first.
 *
 * Scheduled posts group by their send time; everything else groups by when it
 * was created, so the calendar shows what went out as well as what is coming.
 * Grouping happens in **local** time deliberately: a post scheduled for 11pm is
 * on that evening as far as its author is concerned, whatever UTC calls it.
 *
 * Pure, so the day boundaries can be tested without a browser.
 */
export function groupPostsByDay(input: {
  posts: SocialPostSummaryView[];
  toLocalDate?: (isoInstant: string) => string;
}): CalendarDay[] {
  const toLocalDate =
    input.toLocalDate ??
    ((isoInstant: string) => {
      const value = new Date(isoInstant);
      const pad = (part: number) => String(part).padStart(2, "0");
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    });

  const byDate = new Map<string, SocialPostSummaryView[]>();
  for (const post of input.posts) {
    const date = toLocalDate(post.scheduledAt ?? post.createdAt);
    const existing = byDate.get(date);
    if (existing) existing.push(post);
    else byDate.set(date, [post]);
  }

  return [...byDate.entries()]
    .map(([date, posts]) => ({
      date,
      posts: [...posts].sort((left, right) =>
        (left.scheduledAt ?? left.createdAt).localeCompare(
          right.scheduledAt ?? right.createdAt,
        ),
      ),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
