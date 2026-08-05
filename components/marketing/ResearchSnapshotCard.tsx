import type { MarketingResearchSnapshot } from "@/db/schema";
import {
  researchCitationSchema,
  researchSnapshotDocumentSchema,
} from "@/lib/schemas/marketing-research";

export function ResearchSnapshotCard({
  snapshot,
  stale,
}: {
  snapshot: MarketingResearchSnapshot;
  stale: boolean;
}) {
  const document = researchSnapshotDocumentSchema.safeParse(
    snapshot.resultDocument,
  );
  const citations = researchCitationSchema
    .array()
    .safeParse(snapshot.citations);
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {snapshot.kind} {stale ? "· stale" : "· current"}
        </p>
        <h3 className="font-medium">{snapshot.topic}</h3>
      </div>
      {snapshot.status === "failed" ? (
        <p className="text-sm text-destructive">{snapshot.safeErrorMessage}</p>
      ) : null}
      {document.success && citations.success ? (
        <>
          <p className="text-sm">{document.data.summary}</p>
          <ul className="space-y-2 text-sm">
            {document.data.findings.slice(0, 5).map((finding) => (
              <li key={finding.statement}>
                {finding.statement}{" "}
                {finding.sourceIndexes.map((index) => {
                  const citation = citations.data[index];
                  return citation ? (
                    <a
                      aria-label={`Source ${index + 1}: ${citation.title}`}
                      className="text-primary hover:underline"
                      href={citation.url}
                      key={`${finding.statement}-${index}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      [{index + 1}]
                    </a>
                  ) : null;
                })}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {snapshot.status === "succeeded"
            ? "Stored research could not be rendered safely."
            : `Research ${snapshot.status}.`}
        </p>
      )}
    </article>
  );
}
