import "server-only";

import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";

/**
 * Stands in for every platform so the whole compose → schedule → publish loop
 * can be exercised without live accounts, approved apps, or a public URL.
 *
 * This matters more here than it did for video publishing: LinkedIn posting
 * requires an app LinkedIn has to approve, and that approval is not instant.
 * Without a simulator the scheduler, the target state machine, and the
 * partially-failed reporting would all be unverifiable until then.
 *
 * Must be off in production — a "published" post would never actually exist.
 */
export class SimulatedSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform;

  constructor(
    private readonly input: { platform: ContentPlatform; stepDelayMs: number },
  ) {
    this.platform = input.platform;
  }

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    for (const percent of [15, 40, 70, 95]) {
      await request.onProgress?.(percent);
      if (this.input.stepDelayMs > 0)
        await (request.waitForProcessing
          ? request.waitForProcessing(this.input.stepDelayMs)
          : new Promise((resolve) =>
              setTimeout(resolve, this.input.stepDelayMs),
            ));
    }
    await request.onProgress?.(100);

    const id = `SIM-${this.platform}-${Date.now().toString(36)}`;
    return {
      externalPostId: id,
      externalPostUrl: `https://example.invalid/simulated/${encodeURIComponent(id)}`,
      completionStage:
        this.platform === "tiktok" ? "inbox_delivered" : "published",
    };
  }
}
