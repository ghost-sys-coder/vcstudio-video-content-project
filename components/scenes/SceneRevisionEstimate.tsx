import { formatUsdCents } from "@/lib/format/currency";
import type { SceneRevisionEstimateView } from "@/lib/scenes/scene-revision-view";

export function SceneRevisionEstimate({
  estimate,
}: {
  estimate: SceneRevisionEstimateView;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm" role="status">
      <p className="font-medium">
        Estimated replacement generation:{" "}
        {formatUsdCents(estimate.estimatedCostCents)}
        {estimate.unavailableCount ? " (partial estimate)" : ""}
      </p>
      <ul className="list-disc space-y-1 pl-4">
        {estimate.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        Saving costs nothing and starts no generation. This estimate covers
        replacing affected approved scene images and narration once, using the
        settings above. Outpainting, re-rendering, retries and media not yet
        approved are excluded. Generation settings and budgets are checked again
        when you choose to generate.
      </p>
    </div>
  );
}
