import { afterEach, describe, expect, it, vi } from "vitest";
import { TavilyResearchProvider } from "@/lib/marketing/research/tavily-research-provider";

afterEach(() => vi.restoreAllMocks());

describe("TavilyResearchProvider", () => {
  it("maps a current-news search and preserves source metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "request-1",
          results: [
            {
              title: "Launch",
              url: "https://example.com/launch",
              content: "A sourced announcement",
              published_date: "2026-08-01T00:00:00.000Z",
              score: 0.9,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new TavilyResearchProvider("secret");

    const result = await provider.search({
      query: "current campaign news",
      maxResults: 8,
      recencyDays: 30,
      includeDomains: [],
      excludeDomains: [],
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("https://api.tavily.com/search");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      topic: "news",
      days: 30,
    });
    expect(result.requestId).toBe("request-1");
    expect(result.results[0]?.publishedAt?.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });
});
