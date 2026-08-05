import type { MarketingCompetitor } from "@/db/schema";

export function MarketingCompetitorCard({
  competitor,
}: {
  competitor: MarketingCompetitor;
}) {
  return (
    <article className="rounded-xl border p-4">
      <h3 className="font-medium">{competitor.name}</h3>
      {competitor.websiteUrl ? (
        <a
          className="text-sm text-primary hover:underline"
          href={competitor.websiteUrl}
          rel="noreferrer"
          target="_blank"
        >
          {competitor.websiteUrl}
        </a>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        {competitor.notes || "No research notes."}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {competitor.lastResearchedAt
          ? `Last researched ${competitor.lastResearchedAt.toLocaleString()}`
          : "Research begins with the next campaign automation run."}
      </p>
    </article>
  );
}
