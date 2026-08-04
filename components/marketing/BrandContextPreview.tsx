import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompiledBrandContext } from "@/lib/marketing/brand/compile-brand-context";

/**
 * The exact text the model is given, plus what was left out of it.
 *
 * Deliberately shows the compiled block verbatim rather than a summary of it.
 * The studio grounds every generation on this string, so "what does it know
 * about my business?" has a literal answer, and a user chasing a wrong output
 * can read the input rather than guess at a hidden prompt.
 */
export function BrandContextPreview({
  context,
}: {
  context: CompiledBrandContext;
}) {
  const includedIds = new Set(context.includedDocumentIds);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          ~{context.tokenEstimate.toLocaleString()} tokens
        </Badge>
        <Badge variant="outline">{context.promptVersion}</Badge>
        <Badge variant="outline">
          context version {context.contextVersion}
        </Badge>
        {context.truncated ? (
          <span className="rounded-md border border-notice-warning-edge bg-notice-warning px-2 py-0.5 text-xs text-notice-warning-foreground">
            {context.omittedDocumentCount} document
            {context.omittedDocumentCount === 1 ? "" : "s"} omitted
          </span>
        ) : null}
      </div>

      {!context.hasProfile ? (
        <p className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-sm text-notice-info-foreground">
          There is no brand profile yet. Complete the interview and the studio
          will have something to ground on.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Compiled context</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap">
            {context.text}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {context.candidateDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No summarised documents are marked for inclusion yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {context.candidateDocuments.map((document) => {
                const included = includedIds.has(document.id);
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={document.id}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {document.title}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      ~{document.tokenEstimate.toLocaleString()} tokens
                    </span>
                    <Badge variant={included ? "secondary" : "outline"}>
                      {included ? "Included" : "Omitted"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Documents are included in priority order until the token budget runs
            out. Raise a document&apos;s priority on the Assets tab to keep it
            in. Voice rules, banned phrases and compliance notes are never
            dropped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
