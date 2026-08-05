import { z } from "zod";
import type {
  ResearchQuery,
  ResearchResponse,
  WebResearchProvider,
} from "@/lib/marketing/research/research-provider";

const responseSchema = z.object({
  request_id: z.string().nullable().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.url(),
      content: z.string(),
      published_date: z.string().nullable().optional(),
      score: z.number().nullable().optional(),
    }),
  ),
});

export class TavilyResearchProvider implements WebResearchProvider {
  readonly name = "tavily";

  constructor(private readonly apiKey: string) {}

  async search(query: ResearchQuery): Promise<ResearchResponse> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.query,
        topic: query.recencyDays === null ? "general" : "news",
        search_depth: "basic",
        max_results: Math.min(query.maxResults, 10),
        include_answer: false,
        include_raw_content: false,
        ...(query.recencyDays === null ? {} : { days: query.recencyDays }),
        ...(query.includeDomains.length
          ? { include_domains: query.includeDomains }
          : {}),
        ...(query.excludeDomains.length
          ? { exclude_domains: query.excludeDomains }
          : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const error = new Error(`TAVILY_HTTP_${response.status}`);
      Object.assign(error, { status: response.status });
      throw error;
    }
    const parsed = responseSchema.parse(await response.json());
    return {
      provider: this.name,
      requestId: parsed.request_id ?? null,
      providerCostCents: null,
      results: parsed.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        publishedAt: result.published_date
          ? new Date(result.published_date)
          : null,
        score: result.score ?? null,
      })),
    };
  }
}
