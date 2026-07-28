import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";

/**
 * Irreversible project actions, kept visually separate from the settings form
 * above it so deletion is never one mis-click away from saving a setting.
 *
 * Rendered as a sibling of the settings form rather than inside it: that form
 * is a single `<form>` element and a nested form is invalid HTML.
 */
export function ProjectDangerZone({
  projectId,
  projectName,
  canDelete,
}: {
  projectId: string;
  projectName: string;
  canDelete: boolean;
}) {
  return (
    <section className="max-w-2xl space-y-3 rounded-xl border border-destructive/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting a project permanently erases its scenes, generated images and
          audio, rendered videos, and publish history, and frees the storage
          they use. Archive it instead if you only want it out of the way.
        </p>
      </div>
      {canDelete ? (
        <DeleteProjectDialog projectId={projectId} projectName={projectName} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Only workspace owners can delete a project.
        </p>
      )}
    </section>
  );
}
