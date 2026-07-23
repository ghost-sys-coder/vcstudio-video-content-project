import "server-only";

import { randomUUID } from "node:crypto";
import type { ContentPlatform } from "@/db/schema";
import type {
  AuthorizationRequest,
  PlatformAccount,
  PlatformTokens,
  PublishVideoRequest,
  PublishVideoResult,
  VideoPublishProvider,
} from "@/lib/publishing/video-publish-provider";

/**
 * A stand-in provider that fakes the whole publish lifecycle so the flow can be
 * exercised end to end without a real platform account, live tokens, or a
 * publicly reachable video. Selected by `ENABLE_PUBLISH_SIMULATION`; never used
 * in production.
 *
 * It reports upload progress exactly like a real provider (so the UI shows the
 * ramp), then returns a synthetic success. It deliberately does NOT touch the
 * network — no OAuth, no Graph API, no resumable upload.
 */
export class SimulatedVideoPublishProvider implements VideoPublishProvider {
  readonly platform: ContentPlatform;
  readonly accountLabel = "Simulated account";

  private readonly stepDelayMs: number;

  constructor(input: { platform: ContentPlatform; stepDelayMs: number }) {
    this.platform = input.platform;
    this.stepDelayMs = Math.max(0, input.stepDelayMs);
  }

  createAuthorizationUrl(request: AuthorizationRequest): string {
    // Not exercised in simulation (connections already exist), but kept honest.
    return `https://example.com/simulated-oauth?state=${encodeURIComponent(
      request.state,
    )}`;
  }

  async exchangeCode(): Promise<{
    tokens: PlatformTokens;
    account: PlatformAccount;
  }> {
    return {
      tokens: this.fakeTokens(),
      account: {
        externalAccountId: `simulated-${this.platform}`,
        externalAccountName: `Simulated ${this.platform} account`,
        externalAccountUrl: null,
      },
    };
  }

  async refreshTokens(): Promise<PlatformTokens> {
    // The task may refresh a near-expiry token before uploading; keep it happy.
    return this.fakeTokens();
  }

  async publishVideo(
    request: PublishVideoRequest,
  ): Promise<PublishVideoResult> {
    const wait =
      request.waitForProcessing ??
      ((milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

    // Ramp the upload the way a chunked uploader would, so the progress bar and
    // polling behave exactly as in a real run.
    for (const percent of [15, 40, 65, 90]) {
      await request.onProgress?.(percent);
      if (this.stepDelayMs > 0) await wait(this.stepDelayMs);
    }
    // Instagram-style async container processing, mirrored so its UI path runs.
    await request.onProcessingProgress?.(100);
    await request.onProgress?.(100);

    const id = `SIM${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    return {
      externalVideoId: id,
      externalVideoUrl: this.simulatedUrl(id),
      uploadedBytes: request.sizeBytes,
      // TikTok delivers to an inbox rather than publishing; mirror that so its
      // "Delivered to inbox" copy shows. Everything else "publishes".
      completionStage:
        this.platform === "tiktok" ? "inbox_delivered" : "published",
    };
  }

  private simulatedUrl(id: string): string {
    switch (this.platform) {
      case "youtube":
        return `https://www.youtube.com/watch?v=${id}`;
      case "facebook":
        return `https://www.facebook.com/watch/?v=${id}`;
      case "instagram":
        return `https://www.instagram.com/reel/${id}/`;
      case "tiktok":
        return `https://www.tiktok.com/@simulated`;
      default:
        return `https://example.com/${id}`;
    }
  }

  private fakeTokens(): PlatformTokens {
    return {
      accessToken: `simulated-access-${randomUUID()}`,
      refreshToken: `simulated-refresh-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scopes: [],
    };
  }
}
