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
          <h4 className="text-sm font-medium">Findings</h4>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {document.data.findings.map((finding) => (
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
          {document.data.opportunities.length ? (
            <>
              <h4 className="text-sm font-medium">Opportunities</h4>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {document.data.opportunities.map((item) => (
                  <li key={item.statement}>{item.statement}</li>
                ))}
              </ul>
            </>
          ) : null}
          {document.data.risks.length ? (
            <>
              <h4 className="text-sm font-medium">Risks</h4>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {document.data.risks.map((item) => (
                  <li key={item.statement}>{item.statement}</li>
                ))}
              </ul>
            </>
          ) : null}
          {document.data.contentAngles.length ? (
            <>
              <h4 className="text-sm font-medium">Content opportunities</h4>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {document.data.contentAngles.map((item) => (
                  <li key={item.angle}>
                    <span className="font-medium">{item.angle}</span>:{" "}
                    {item.rationale}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Sources ({citations.data.length})
            </summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {citations.data.map((citation) => (
                <li key={citation.url}>
                  <a
                    className="text-primary hover:underline"
                    href={citation.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {citation.title}
                  </a>
                  {citation.snippet ? (
                    <p className="text-muted-foreground">{citation.snippet}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
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
