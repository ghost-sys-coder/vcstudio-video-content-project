import { describe, expect, it } from "vitest";
import { groupPostsByDay } from "@/lib/social/schedule-calendar";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

function post(
  overrides: Partial<SocialPostSummaryView> & { id: string },
): SocialPostSummaryView {
  return {
    name: "Post",
    status: "draft",
    excerpt: "",
    scheduledAt: null,
    scheduledTimezone: "UTC",
    createdAt: "2026-07-30T09:00:00.000Z",
    targets: [],
    mediaCount: 0,
    mediaPreviewUrl: null,
    mediaKind: null,
    calendarAt: overrides.scheduledAt ?? "2026-07-30T09:00:00.000Z",
    ...overrides,
  };
}

// Injected so the grouping can be asserted without depending on the machine's
// timezone, which is exactly the ambiguity the function exists to resolve.
const toLocalDate = (iso: string) => iso.slice(0, 10);

describe("groupPostsByDay", () => {
  it("groups by scheduled time when present, and creation time otherwise", () => {
    const days = groupPostsByDay({
      toLocalDate,
      posts: [
        post({ id: "a", createdAt: "2026-08-01T09:00:00.000Z" }),
        post({
          id: "b",
          scheduledAt: "2026-07-30T18:00:00.000Z",
          createdAt: "2026-08-01T09:00:00.000Z",
        }),
      ],
    });
    expect(days.map((day) => day.date)).toEqual(["2026-07-30", "2026-08-01"]);
    expect(days[0].posts.map((entry) => entry.id)).toEqual(["b"]);
    expect(days[1].posts.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("orders days oldest first and posts within a day by time", () => {
    const days = groupPostsByDay({
      toLocalDate,
      posts: [
        post({ id: "late", scheduledAt: "2026-07-30T18:00:00.000Z" }),
        post({ id: "early", scheduledAt: "2026-07-30T07:00:00.000Z" }),
        post({ id: "next-day", scheduledAt: "2026-07-31T07:00:00.000Z" }),
      ],
    });
    expect(days.map((day) => day.date)).toEqual(["2026-07-30", "2026-07-31"]);
    expect(days[0].posts.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupPostsByDay({ posts: [], toLocalDate })).toEqual([]);
  });

  it("keeps several posts on the same day together", () => {
    const days = groupPostsByDay({
      toLocalDate,
      posts: [
        post({ id: "a", scheduledAt: "2026-07-30T07:00:00.000Z" }),
        post({ id: "b", scheduledAt: "2026-07-30T08:00:00.000Z" }),
        post({ id: "c", scheduledAt: "2026-07-30T09:00:00.000Z" }),
      ],
    });
    expect(days).toHaveLength(1);
    expect(days[0].posts).toHaveLength(3);
  });
});
