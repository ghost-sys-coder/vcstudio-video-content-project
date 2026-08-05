import "server-only";
import { getMarketingEnvironment } from "@/lib/env/server";
import type { WebResearchProvider } from "@/lib/marketing/research/research-provider";
import { TavilyResearchProvider } from "@/lib/marketing/research/tavily-research-provider";

export function isResearchProviderConfigured(): boolean {
  const environment = getMarketingEnvironment();
  return (
    environment.MARKETING_RESEARCH_PROVIDER === "tavily" &&
    Boolean(environment.TAVILY_API_KEY)
  );
}

export function createResearchProvider(): WebResearchProvider {
  const environment = getMarketingEnvironment();
  switch (environment.MARKETING_RESEARCH_PROVIDER) {
    case "tavily":
      if (!environment.TAVILY_API_KEY)
        throw new Error("MARKETING_RESEARCH_NOT_CONFIGURED");
      return new TavilyResearchProvider(environment.TAVILY_API_KEY);
    case "none":
      throw new Error("MARKETING_RESEARCH_NOT_CONFIGURED");
    case "brave":
    case "serpapi":
      throw new Error("MARKETING_RESEARCH_PROVIDER_NOT_IMPLEMENTED");
  }
}
