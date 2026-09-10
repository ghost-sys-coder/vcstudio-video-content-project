import { describe, expect, it } from "vitest";
import type { ReleaseSchedule } from "@/db/schema";
import { toReleaseScheduleListView } from "@/lib/releases/release-schedule-view";

const now = new Date("2026-09-14T06:00:00Z");

function row(overrides: Partial<ReleaseSchedule> = {}): ReleaseSchedule {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    releasePackageId: "44444444-4444-4444-8444-444444444444",
    renderId: "55555555-5555-4555-8555-555555555555",
    connectionId: "66666666-6666-4666-8666-666666666666",
    platform: "youtube",
    scheduledAt: new Date("2026-09-15T06:00:00Z"),
    timeZone: "Africa/Kampala",
    status: "scheduled",
    publicationId: null,
    attemptCount: 0,
    safeErrorMessage: null,
    claimedAt: null,
    dispatchedAt: null,
    cancelledAt: null,
    requestedByUserId: "77777777-7777-4777-8777-777777777777",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ReleaseSchedule;
}

describe("toReleaseScheduleListView", () => {
  it("shows the time in the zone it was written in, and names that zone", () => {
    // 06:00 UTC is 09:00 in Kampala. Showing the instant alone would read as
    // the wrong hour to the person who chose it.
    const [entry] = toReleaseScheduleListView([row()], now).schedules;
    expect(entry?.scheduledLabel).toContain("09:00");
    expect(entry?.timeZone).toBe("Africa/Kampala");
  });

  it("keeps the instant available alongside the label", () => {
    const [entry] = toReleaseScheduleListView([row()], now).schedules;
    expect(entry?.scheduledAtIso).toBe("2026-09-15T06:00:00.000Z");
  });

  it("labels the state without ever claiming something was published", () => {
    const [entry] = toReleaseScheduleListView(
      [row({ status: "dispatched", publicationId: "pub", dispatchedAt: now })],
      now,
    ).schedules;
    expect(entry?.stateLabel).toBe("Handed to upload");
  });

  it("offers cancel only while it is still waiting", () => {
    expect(
      toReleaseScheduleListView([row()], now).schedules[0]?.canCancel,
    ).toBe(true);
    expect(
      toReleaseScheduleListView([row({ status: "claimed" })], now).schedules[0]
        ?.canCancel,
    ).toBe(false);
  });

  it("marks a schedule that is well past its time as overdue", () => {
    const [entry] = toReleaseScheduleListView(
      [row({ scheduledAt: new Date("2026-09-14T04:00:00Z") })],
      now,
    ).schedules;
    expect(entry?.overdue).toBe(true);
  });

  it("does not call a schedule overdue inside the sweep window", () => {
    const [entry] = toReleaseScheduleListView(
      [row({ scheduledAt: new Date("2026-09-14T05:55:00Z") })],
      now,
    ).schedules;
    expect(entry?.overdue).toBe(false);
  });

  it("carries a failure reason through rather than hiding it", () => {
    const [entry] = toReleaseScheduleListView(
      [row({ status: "failed", safeErrorMessage: "That render was deleted." })],
      now,
    ).schedules;
    expect(entry?.safeErrorMessage).toBe("That render was deleted.");
    expect(entry?.stateLabel).toBe("Failed to start");
  });

  it("names the platform", () => {
    const [entry] = toReleaseScheduleListView(
      [row({ platform: "instagram" })],
      now,
    ).schedules;
    expect(entry?.platformLabel).toBe("Instagram");
  });

  it("returns an empty list rather than failing on no schedules", () => {
    expect(toReleaseScheduleListView([], now).schedules).toEqual([]);
  });
});
