import { Badge } from "@/components/ui/badge";
import { formatUsdCents } from "@/lib/format/currency";

export function GenerationCostEstimate({
  id,
  estimatedCostCents,
  model,
  outputFormat,
  compression,
  budgetAvailable = true,
}: {
  id: string;
  estimatedCostCents: number;
  model: string;
  outputFormat: string;
  compression: number;
  budgetAvailable?: boolean;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium" id={`${id}-heading`}>
            Conservative cost estimate
          </h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatUsdCents(estimatedCostCents)}
          </p>
        </div>
        <Badge variant={budgetAvailable ? "secondary" : "destructive"}>
          {budgetAvailable ? "Budget available" : "Budget unavailable"}
        </Badge>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {model} / {outputFormat.toUpperCase()} at {compression}% compression.
        The estimate is reserved before the provider call, then reconciled to
        provider usage after completion.
      </p>
    </section>
  );
}
