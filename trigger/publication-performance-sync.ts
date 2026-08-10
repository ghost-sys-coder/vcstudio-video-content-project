import {
  discoverPerformanceSources,
  listDuePerformanceSources,
  markPerformanceSyncUnavailable,
  recordPerformanceSync,
} from "@/db/repositories/publication-performance.repository";
import { openSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import {
  fetchYouTubePerformance,
  PerformanceProviderError,
} from "@/lib/marketing/performance/youtube-analytics-provider";

export async function runPublicationPerformanceSync() {
  const discovered = await discoverPerformanceSources();
  const now = new Date();
  const sources = await listDuePerformanceSources(now);
  let synced = 0;
  let unavailable = 0;
  for (const source of sources) {
    if (
      source.platform !== "youtube" ||
      source.connectionStatus !== "active" ||
      !source.accessTokenSealed
    ) {
      await markPerformanceSyncUnavailable({
        sourceId: source.id,
        status: "permission_required",
        message:
          "The provider connection is unavailable. Historical observations remain preserved.",
        now,
      });
      unavailable += 1;
      continue;
    }
    try {
      const environment = getPublishingEnvironment();
      const observations = await fetchYouTubePerformance({
        accessToken: openSecret({
          sealed: source.accessTokenSealed,
          key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
        }),
        providerPublicationId: source.providerPublicationId,
      });
      await recordPerformanceSync({ source, observations, observedAt: now });
      synced += 1;
    } catch (error) {
      const providerError =
        error instanceof PerformanceProviderError ? error : null;
      await markPerformanceSyncUnavailable({
        sourceId: source.id,
        status:
          providerError?.category === "authorization"
            ? "permission_required"
            : providerError?.category === "rate_limited"
              ? "rate_limited"
              : "failed",
        message:
          providerError?.safeMessage ??
          "Performance data could not be refreshed.",
        now,
      });
      unavailable += 1;
    }
  }
  return { discovered, checked: sources.length, synced, unavailable };
}
