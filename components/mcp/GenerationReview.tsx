import type { ReactNode } from "react";
import type { GenerationPreview } from "@studio/contracts/mcp-generation";
import { Badge } from "@/components/ui/badge";
import { formatGenerationCost } from "@/lib/mcp/generation-presentation";
export function GenerationReview({
  preview,
  autonomous,
  actions,
}: {
  preview: GenerationPreview;
  autonomous?: boolean;
  actions: ReactNode;
}) {
  return (
    <section className="app-panel app-section">
      <div className="app-page-header">
        <div className="app-heading">
          <h2 className="text-xl font-semibold">Review media generation</h2>
          <p className="text-sm text-muted-foreground">
            {autonomous
              ? "Your authorized assistant can execute this exact preparation."
              : "Review the exact request before authorizing generation. This preview is valid for ten minutes."}
          </p>
        </div>
        <Badge variant="secondary">{preview.kind.replaceAll("_", " ")}</Badge>
      </div>
      <div className="app-grid sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Estimated cost</p>
          <p className="text-2xl font-semibold">
            {formatGenerationCost(preview.estimatedCostCents)}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Authorized estimate limit
          </p>
          <p className="text-2xl font-semibold">
            {formatGenerationCost(preview.maximumCostCents)}
          </p>
        </div>
      </div>
      <dl className="grid min-w-0 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="wrap-break-word">
            {preview.provider} · {preview.model}
          </dd>
        </div>
        {preview.settings.map((setting) => (
          <div key={setting.label}>
            <dt className="text-muted-foreground">{setting.label}</dt>
            <dd className="whitespace-pre-wrap wrap-break-word">
              {setting.value || "None"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="app-heading">
        <h3 className="font-medium">
          {preview.kind.endsWith("audio") ? "Narration text" : "Image prompt"}
        </h3>
        <p className="max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word rounded-xl bg-muted/45 p-4 text-sm">
          {preview.text}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Workspace and project budgets are enforced before submission. Actual
        provider usage is recorded in Usage &amp; budgets and can differ from
        the estimate. A failed or interrupted provider attempt may still incur a
        charge. Generated scene media remains awaiting explicit review.
      </p>
      {actions}
    </section>
  );
}
