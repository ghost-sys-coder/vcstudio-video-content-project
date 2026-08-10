import "server-only";

import { z } from "zod";
import type { PerformanceObservation } from "@/lib/marketing/performance/performance-metrics";

const responseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      statistics: z
        .object({
          viewCount: z.string().regex(/^\d+$/).optional(),
          likeCount: z.string().regex(/^\d+$/).optional(),
          commentCount: z.string().regex(/^\d+$/).optional(),
        })
        .optional(),
    }),
  ),
});

export class PerformanceProviderError extends Error {
  constructor(
    readonly category: "authorization" | "rate_limited" | "provider",
    readonly safeMessage: string,
  ) {
    super(safeMessage);
  }
}

export async function fetchYouTubePerformance(input: {
  accessToken: string;
  providerPublicationId: string;
}): Promise<PerformanceObservation[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", input.providerPublicationId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new PerformanceProviderError(
        "authorization",
        "YouTube analytics authorization is unavailable. Reconnect the channel.",
      );
    if (response.status === 429)
      throw new PerformanceProviderError(
        "rate_limited",
        "YouTube analytics quota is temporarily exhausted.",
      );
    throw new PerformanceProviderError(
      "provider",
      "YouTube performance data could not be refreshed.",
    );
  }
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new PerformanceProviderError(
      "provider",
      "YouTube returned an unsupported analytics response.",
    );
  const statistics = parsed.data.items[0]?.statistics;
  if (!statistics) return [];
  const observations: PerformanceObservation[] = [];
  const add = (
    rawMetricKey: "viewCount" | "likeCount" | "commentCount",
    metricKind: "views" | "engagement",
    definition: string,
  ) => {
    const rawValue = statistics[rawMetricKey];
    if (rawValue === undefined) return;
    observations.push({
      metricKind,
      unit: "count",
      normalizedValue: Number(rawValue),
      rawMetricKey,
      rawValue,
      providerDefinition: definition,
      providerDefinitionVersion: "youtube-data-v3-2026-07-08",
      comparableGroup:
        rawMetricKey === "viewCount" ? "video_starts_or_views" : null,
    });
  };
  add(
    "viewCount",
    "views",
    "YouTube lifetime video viewCount. Shorts count starts and replays without a minimum watch-time requirement from 2025-03-31.",
  );
  add("likeCount", "engagement", "YouTube lifetime public likeCount.");
  add("commentCount", "engagement", "YouTube lifetime commentCount.");
  return observations;
}
