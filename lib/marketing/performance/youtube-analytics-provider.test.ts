import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchYouTubePerformance } from "@/lib/marketing/performance/youtube-analytics-provider";

describe("YouTube performance provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves raw metric identities and the versioned definition", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "video",
                statistics: {
                  viewCount: "12",
                  likeCount: "3",
                  commentCount: "1",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await fetchYouTubePerformance({
      accessToken: "token",
      providerPublicationId: "video",
    });
    expect(result.map((entry) => entry.rawMetricKey)).toEqual([
      "viewCount",
      "likeCount",
      "commentCount",
    ]);
    expect(result[0]?.providerDefinitionVersion).toBe(
      "youtube-data-v3-2026-07-08",
    );
  });
});
