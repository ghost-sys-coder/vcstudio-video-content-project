import { FolderKanbanIcon } from "lucide-react";

export function EmptyProjectsState() {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <FolderKanbanIcon className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">No projects yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create the first project to start writing and versioning a narration
        script.
      </p>
    </div>
  );
}
