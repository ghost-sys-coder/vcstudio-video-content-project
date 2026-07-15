"use client";

import type { ProjectScriptVersion } from "@/db/schema";
import { ScriptVersionItem } from "@/components/projects/ScriptVersionItem";

export function ScriptVersionHistory({
  versions,
  revision,
  canEdit,
  onRestored,
}: {
  versions: ProjectScriptVersion[];
  revision: number;
  canEdit: boolean;
  onRestored: (revision: number) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Version history</h2>
      {versions.length ? (
        <ol className="mt-4 space-y-3">
          {versions.map((version) => (
            <ScriptVersionItem
              canEdit={canEdit}
              key={version.id}
              onRestored={onRestored}
              revision={revision}
              version={version}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No versions yet. Save the draft, then create the first version.
        </p>
      )}
    </section>
  );
}
