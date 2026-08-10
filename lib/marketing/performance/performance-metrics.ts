import { z } from "zod";
import type {
  ContentPlatform,
  PerformanceMetricKind,
  PerformanceMetricUnit,
} from "@/db/schema";

export const performanceObservationSchema = z.object({
  metricKind: z.enum([
    "impressions",
    "views",
    "watch_time",
    "retention",
    "engagement",
    "clicks",
    "conversions",
  ]),
  unit: z.enum(["count", "milliseconds", "ratio"]),
  normalizedValue: z.number().nonnegative().finite(),
  rawMetricKey: z.string().min(1).max(120),
  rawValue: z.string().min(1).max(120),
  providerDefinition: z.string().min(1).max(1_000),
  providerDefinitionVersion: z.string().min(1).max(120),
  comparableGroup: z.string().min(1).max(120).nullable(),
});

export type PerformanceObservation = z.infer<
  typeof performanceObservationSchema
>;

export type AnalyticsCapability = {
  platform: ContentPlatform;
  status: "available" | "permission_required" | "review_required";
  availableMetrics: PerformanceMetricKind[];
  missingMetrics: PerformanceMetricKind[];
  requirement: string;
};

const ALL_METRICS: PerformanceMetricKind[] = [
  "impressions",
  "views",
  "watch_time",
  "retention",
  "engagement",
  "clicks",
  "conversions",
];

const capability = (
  platform: ContentPlatform,
  status: AnalyticsCapability["status"],
  availableMetrics: PerformanceMetricKind[],
  requirement: string,
): AnalyticsCapability => ({
  platform,
  status,
  availableMetrics,
  missingMetrics: ALL_METRICS.filter(
    (metric) => !availableMetrics.includes(metric),
  ),
  requirement,
});

export const ANALYTICS_CAPABILITIES: AnalyticsCapability[] = [
  capability(
    "youtube",
    "available",
    ["views", "engagement"],
    "Current youtube.readonly access supports video views, likes, and comments. Watch time and retention require YouTube Analytics authorization.",
  ),
  capability(
    "facebook",
    "review_required",
    [],
    "The connection has pages_read_engagement, but the app must complete and validate Meta's Page Insights review before normalized sync is enabled.",
  ),
  capability(
    "instagram",
    "permission_required",
    [],
    "Reconnect after instagram_business_manage_insights is approved and added to the Instagram authorization flow.",
  ),
  capability(
    "tiktok",
    "permission_required",
    [],
    "Reconnect after video.list is approved and added; the current video.upload grant cannot read performance.",
  ),
  capability(
    "linkedin",
    "review_required",
    [],
    "Organization analytics require Community Management API approval and organization-admin authorization; member posting access is insufficient.",
  ),
  capability(
    "twitter",
    "review_required",
    [],
    "Organic analytics availability depends on the X API access tier. No unsupported metrics are inferred from public counters.",
  ),
];

export function metricUnit(
  metric: PerformanceMetricKind,
): PerformanceMetricUnit {
  if (metric === "watch_time") return "milliseconds";
  if (metric === "retention") return "ratio";
  return "count";
}
