import type { VideoModelPricing } from "@studio/contracts/video";
import type { VideoProviderState } from "./video-provider";
export function measuredVideoCost(
  pricing: VideoModelPricing,
  usage: Extract<VideoProviderState, { status: "succeeded" }>["usage"],
): number | null {
  if (usage?.creditsCharged !== undefined) {
    if (!pricing.creditUsdMicros) return null;
    return Math.ceil((usage.creditsCharged * pricing.creditUsdMicros) / 10_000);
  }
  if (
    !usage ||
    usage.unknownOutputTokens ||
    !pricing.tokenPricing ||
    usage.videoTokens <= 0 ||
    usage.videoTokens > usage.outputTokens
  )
    return null;
  const rate = pricing.tokenPricing;
  const cost = Math.ceil(
    (usage.inputTokens * rate.inputUsdPerMillion +
      (usage.outputTokens - usage.videoTokens + usage.thoughtTokens) *
        rate.textUsdPerMillion +
      usage.videoTokens * rate.videoUsdPerMillion) /
      10000,
  );
  return Number.isSafeInteger(cost) && cost >= 0 ? cost : null;
}
