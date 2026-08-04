import type { InferSelectModel } from "drizzle-orm";
import type { marketingContentRevisions } from "@/db/schema";
type Revision = InferSelectModel<typeof marketingContentRevisions>;
export function MarketingContentRevisionList({
  revisions,
}: {
  revisions: Revision[];
}) {
  return (
    <div className="space-y-2">
      {revisions.map((revision) => (
        <div className="rounded-lg border p-3 text-sm" key={revision.id}>
          <div className="flex justify-between">
            <span>Revision {revision.revisionNumber}</span>
            <span className="text-muted-foreground">
              {revision.changeSource}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
            {revision.bodyPlainText}
          </p>
        </div>
      ))}
    </div>
  );
}
