import { FilmIcon } from "lucide-react";
import { ExportCard } from "@/components/render/ExportCard";
import type { RenderExportView } from "@/lib/render/render-view";

export function ExportList({
  exports,
  projectId,
}: {
  exports: RenderExportView[];
  projectId: string;
}) {
  if (exports.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <FilmIcon aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No exports yet</p>
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          Start a render to produce a downloadable video. Completed renders
          appear here with their download links.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      {exports.map((render) => (
        <ExportCard key={render.id} projectId={projectId} render={render} />
      ))}
    </div>
  );
}
