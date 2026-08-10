import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CAPABILITIES,
  performanceObservationSchema,
} from "@/lib/marketing/performance/performance-metrics";

describe("performance metric contract", () => {
  it("rejects negative and unversioned provider observations", () => {
    expect(
      performanceObservationSchema.safeParse({
        metricKind: "views",
        unit: "count",
        normalizedValue: -1,
        rawMetricKey: "viewCount",
        rawValue: "-1",
        providerDefinition: "Provider lifetime view count.",
        providerDefinitionVersion: "",
        comparableGroup: null,
      }).success,
    ).toBe(false);
  });

  it("makes missing and review-gated metrics explicit", () => {
    const tikTok = ANALYTICS_CAPABILITIES.find(
      (entry) => entry.platform === "tiktok",
    );
    expect(tikTok).toMatchObject({
      status: "permission_required",
      availableMetrics: [],
    });
    expect(tikTok?.missingMetrics).toContain("views");
  });
});
