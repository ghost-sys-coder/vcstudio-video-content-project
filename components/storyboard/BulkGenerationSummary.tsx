import { formatUsdCents } from "@/lib/format/currency";

export function BulkGenerationSummary({
  sceneCount,
  sizeCount,
  requestedImageCount,
  estimatedCostCents,
  availableBudgetCents,
  maximumImagesPerBatch,
}: {
  sceneCount: number;
  sizeCount: number;
  requestedImageCount: number;
  estimatedCostCents: number;
  availableBudgetCents: number;
  maximumImagesPerBatch: number;
}) {
  const overBudget = estimatedCostCents > availableBudgetCents;
  const overBatchLimit = requestedImageCount > maximumImagesPerBatch;

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-inset ring-foreground/10">
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Scenes × sizes</dt>
          <dd className="font-mono tabular-nums">
            {sceneCount} × {sizeCount} = {requestedImageCount}{" "}
            {requestedImageCount === 1 ? "image" : "images"}
          </dd>
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
          Select at most {maximumImagesPerBatch} images (scenes × sizes) for one
          batch.
        </p>
      ) : overBudget ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          This batch would exceed the available budget.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Actual cost is recorded per image after each generation completes and
          counts toward the project budget.
        </p>
      )}
    </div>
  );
}
