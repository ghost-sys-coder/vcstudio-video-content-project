import { DownloadExportButton } from "@/components/render/DownloadExportButton";
import { RenderErrorState } from "@/components/render/RenderErrorState";
import { RenderStatusBadge } from "@/components/render/RenderStatusBadge";
import { formatUsdCents } from "@/lib/format/currency";
import { formatDurationMs } from "@/lib/format/duration";
import type { RenderExportView } from "@/lib/render/render-view";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${megabytes.toFixed(1)} MB`;
}

export function ExportCard({
  render,
  projectId,
}: {
  render: RenderExportView;
  projectId: string;
}) {
  const cost = render.actualCostCents ?? render.estimatedCostCents;

  return (
    <article className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-inset ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RenderStatusBadge status={render.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {render.width}×{render.height} · {render.framesPerSecond} fps
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(render.createdAt).toLocaleString()}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt className="opacity-70">Duration</dt>
          <dd className="font-medium text-foreground">
            {formatDurationMs(render.durationMilliseconds)}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Scenes</dt>
          <dd className="font-medium text-foreground">{render.sceneCount}</dd>
        </div>
        <div>
          <dt className="opacity-70">Size</dt>
          <dd className="font-medium text-foreground">
            {render.sizeBytes !== null ? formatBytes(render.sizeBytes) : "—"}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Cost</dt>
          <dd className="font-medium text-foreground">
            {formatUsdCents(cost)}
          </dd>
        </div>
      </dl>

      {render.status === "failed" && render.errorMessage ? (
        <RenderErrorState message={render.errorMessage} />
      ) : null}

      <div className="flex items-center gap-2">
        <DownloadExportButton
          disabled={!render.hasAsset}
          projectId={projectId}
          renderId={render.id}
        />
        {render.includeCaptions ? (
          <span className="text-xs text-muted-foreground">Captions</span>
        ) : null}
        {render.includeWatermark ? (
          <span className="text-xs text-muted-foreground">Watermark</span>
        ) : null}
      </div>
    </article>
  );
}
