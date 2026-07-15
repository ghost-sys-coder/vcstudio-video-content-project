import type { ProjectScriptVersion } from "@/db/schema";
import { RestoreScriptVersionDialog } from "@/components/projects/RestoreScriptVersionDialog";
import { ApproveScriptVersionButton } from "@/components/projects/ApproveScriptVersionButton";
import { DeleteScriptVersionDialog } from "@/components/projects/DeleteScriptVersionDialog";

export function ScriptVersionItem({
  version,
  revision,
  canEdit,
  onRestored,
}: {
  version: ProjectScriptVersion;
  revision: number;
  canEdit: boolean;
  onRestored: (revision: number) => void;
}) {
  return (
    <li className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Version {version.versionNumber}</p>
          <p className="text-xs text-muted-foreground">
            {version.createdAt.toLocaleString()} ·{" "}
            {version.characterCount.toLocaleString()} characters
            {version.restoredFromVersionId ? " · restored" : ""}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ApproveScriptVersionButton
              approved={version.status === "approved"}
              projectId={version.projectId}
              versionId={version.id}
            />
            <RestoreScriptVersionDialog
              onRestored={onRestored}
              projectId={version.projectId}
              revision={revision}
              versionId={version.id}
              versionNumber={version.versionNumber}
            />
            <DeleteScriptVersionDialog
              disabled={version.status === "approved"}
              projectId={version.projectId}
              versionId={version.id}
              versionNumber={version.versionNumber}
            />
          </div>
        ) : null}
      </div>
      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {version.content || "Empty script"}
      </p>
    </li>
  );
}
