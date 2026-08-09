import { describe, expect, it } from "vitest";
import { calculateMarketingQualityMetrics } from "@/lib/marketing/metrics/quality-metrics";

describe("marketing quality metrics", () => {
  it("reconciles a fixture cohort across reviews, edits, publication, cost, and versions", () => {
    const createdAt = new Date("2026-08-01T00:00:00Z");
    const metrics = calculateMarketingQualityMetrics({
      items: [
        {
          id: "one",
          createdAt,
          sourceRunId: "run-1",
          costCents: 20,
          model: "gpt",
          promptVersion: "p1",
          skillKey: "social",
          skillVersion: 2,
          contextVersion: 3,
          currentText: "A changed launch message",
        },
        {
          id: "two",
          createdAt,
          sourceRunId: "run-2",
          costCents: 30,
          model: "gpt",
          promptVersion: "p1",
          skillKey: "social",
          skillVersion: 2,
          contextVersion: 3,
          currentText: "A changed launch message",
        },
      ],
      reviews: [
        {
          contentItemId: "one",
          decision: "approved",
          reason: "",
          createdAt: new Date("2026-08-01T02:00:00Z"),
        },
        {
          contentItemId: "two",
          decision: "changes_requested",
          reason: "Weak hook",
          createdAt: new Date("2026-08-01T04:00:00Z"),
        },
      ],
      revisions: [
        {
          contentItemId: "one",
          revisionNumber: 1,
          changeSource: "ai",
          bodyPlainText: "Original message",
          structuredPayload: null,
        },
        {
          contentItemId: "one",
          revisionNumber: 2,
          changeSource: "human",
          bodyPlainText: "A changed launch message",
          structuredPayload: null,
        },
      ],
      publications: [
        { contentItemId: "one", platform: "linkedin", status: "published" },
      ],
    });
    expect(metrics).toMatchObject({
      generated: 2,
      reviewed: 2,
      approved: 1,
      rejected: 1,
      approvalRate: 0.5,
      substantiveEditRate: 1,
      duplicateContentRate: 1,
      averageFirstReviewHours: 3,
      costPerApprovedCents: 50,
      costPerPublishedCents: 50,
      sampleConfidence: "low",
    });
    expect(metrics.rejectionReasons).toEqual([
      { label: "Weak hook", count: 1 },
    ]);
  });
});
