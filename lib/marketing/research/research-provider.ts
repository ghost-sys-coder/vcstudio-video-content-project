export type ResearchQuery = {
  query: string;
  maxResults: number;
  recencyDays: number | null;
  includeDomains: string[];
  excludeDomains: string[];
};

export type ResearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt: Date | null;
  score: number | null;
};

export type ResearchResponse = {
  provider: string;
  requestId: string | null;
  results: ResearchResult[];
  providerCostCents: number | null;
};

export interface WebResearchProvider {
  readonly name: string;
  search(query: ResearchQuery): Promise<ResearchResponse>;
}
