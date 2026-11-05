import { describe, expect, it } from "vitest";
import {
  RELEASE_STATE_LABELS,
  buildProductionQueueHref,
  formatPlannedRelease,
  summarizeProductionQueue,
} from "@/lib/production/production-queue-view";
import type { ProductionReadiness } from "./production-readiness";

describe("page-local queue summary", () => {
  it("counts projects once, keeps warnings separate from blockers and allows overlapping reviews", () => {
    const action = { label: "Review", href: "scenes" };
    const blocked: Pick<ProductionReadiness, "blockers" | "reviews"> = {
      blockers: [
        {
          kind: "images_failed",
          severity: "blocking",
          message: "Failed",
          action,
        },
        {
          kind: "audio_failed",
          severity: "blocking",
          message: "Failed",
          action,
        },
      ],
      reviews: [
        {
          kind: "images_awaiting_review",
          count: 3,
          message: "Three reviews",
          action,
        },
      ],
    };
    const warning: Pick<ProductionReadiness, "blockers" | "reviews"> = {
      blockers: [
        {
          kind: "render_failed",
          severity: "warning",
          message: "Warning",
          action,
        },
      ],
      reviews: [],
    };
    expect(
      summarizeProductionQueue([
        { readiness: blocked },
        { readiness: warning },
      ]),
    ).toEqual({ shown: 2, blocked: 1, awaitingReview: 1 });
    expect(summarizeProductionQueue([])).toEqual({
      shown: 0,
      blocked: 0,
      awaitingReview: 0,
    });
  });
});

describe("buildProductionQueueHref", () => {
  it("keeps the bare queue URL clean when nothing is filtered", () => {
    expect(buildProductionQueueHref({})).toBe("/app/queue");
    expect(
      buildProductionQueueHref({ attention: "all", release: "all", page: 1 }),
    ).toBe("/app/queue");
  });

  it("preserves the other filters when one changes", () => {
    // Changing a filter must not silently drop the rest of the view.
    const href = buildProductionQueueHref({
      attention: "blocked",
      channelProfileId: "11111111-1111-4111-8111-111111111111",
      release: "scheduled",
    });
    expect(href).toContain("attention=blocked");
    expect(href).toContain("release=scheduled");
    expect(href).toContain(
      "channelProfileId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("omits page one so the first page has one canonical URL", () => {
    expect(buildProductionQueueHref({ page: 1 })).toBe("/app/queue");
    expect(buildProductionQueueHref({ page: 3 })).toBe("/app/queue?page=3");
  });
});

describe("formatPlannedRelease", () => {
  it("says plainly when no date is set", () => {
    expect(formatPlannedRelease(null)).toBe("No date set");
  });

  it("formats in UTC so the day does not drift with the viewer's zone", () => {
    // A date stored at midnight UTC must not read as the previous day for a
    // viewer west of Greenwich.
    const formatted = formatPlannedRelease(
      new Date("2026-12-01T00:00:00.000Z"),
    );
    expect(formatted).toBe("Dec 1, 2026");
    // The drift this guards against would render the previous day.
    expect(formatted).not.toContain("Nov");
  });
});

describe("release labels", () => {
  it("never describes a release state as complete", () => {
    // Rendered is not published, and scheduled is neither.
    const labels = Object.values(RELEASE_STATE_LABELS).join(" ").toLowerCase();
    expect(labels).not.toContain("complete");
    expect(RELEASE_STATE_LABELS.rendered).toBe("Rendered");
    expect(RELEASE_STATE_LABELS.published).toBe("Published");
    expect(RELEASE_STATE_LABELS.scheduled).toBe("Scheduled");
  });
});
