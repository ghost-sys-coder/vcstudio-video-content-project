import type { PortraitGenerationRow } from "@/lib/characters/character-reference-generation-view";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<PortraitGenerationRow["status"], string> = {
  queued: "Queued",
  running: "Generating",
  succeeded: "Saved",
  failed: "Failed",
};

const statusVariants: Record<
  PortraitGenerationRow["status"],
  "secondary" | "outline" | "destructive"
> = {
  queued: "outline",
  running: "outline",
  succeeded: "secondary",
  failed: "destructive",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function CharacterPortraitGenerationList({
  rows,
}: {
  rows: PortraitGenerationRow[];
}) {
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No portraits generated yet. Generated portraits appear in the gallery
        above once they finish; refresh to see status updates.
      </p>
    );

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          key={row.id}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium capitalize">
              {row.referenceType}
            </span>
            <Badge variant={statusVariants[row.status]}>
              {statusLabels[row.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {row.createdAtLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {row.status === "succeeded"
                ? `Cost ${formatCents(row.actualCostCents)}`
                : `Est. ${formatCents(row.estimatedCostCents)}`}
            </span>
          </div>
          {row.status === "failed" && row.safeErrorMessage ? (
            <p className="w-full text-xs text-destructive">
              {row.safeErrorMessage}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
