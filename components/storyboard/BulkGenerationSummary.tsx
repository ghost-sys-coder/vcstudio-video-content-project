import { formatUsdCents } from "@/lib/format/currency";

export function BulkGenerationSummary({
  sceneCount,
  estimatedCostCents,
  availableBudgetCents,
  maximumImagesPerBatch,
}: {
  sceneCount: number;
  estimatedCostCents: number;
  availableBudgetCents: number;
  maximumImagesPerBatch: number;
}) {
  const overBudget = estimatedCostCents > availableBudgetCents;
  const overBatchLimit = sceneCount > maximumImagesPerBatch;

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-inset ring-foreground/10">
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Scenes</dt>
          <dd className="font-mono tabular-nums">{sceneCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Estimated cost</dt>
          <dd className="font-mono tabular-nums">
            {formatUsdCents(estimatedCostCents)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Remaining budget</dt>
          <dd className="font-mono tabular-nums">
            {formatUsdCents(availableBudgetCents)}
          </dd>
        </div>
      </dl>
      {overBatchLimit ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          Select at most {maximumImagesPerBatch} scenes for one batch.
        </p>
      ) : overBudget ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          This batch would exceed the available budget.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Actual cost is recorded per scene after each image completes and
          counts toward the project budget.
        </p>
      )}
    </div>
  );
}
