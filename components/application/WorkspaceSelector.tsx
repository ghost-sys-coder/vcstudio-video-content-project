import { selectWorkspaceAction } from "@/app/(authenticated)/app/actions";
import { Button } from "@/components/ui/button";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";

export function WorkspaceSelector({
  activeWorkspaceId,
  memberships,
}: {
  activeWorkspaceId: string;
  memberships: WorkspaceMembershipView[];
}) {
  return (
    <form action={selectWorkspaceAction} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="workspace-selector">
        Active workspace
      </label>
      <select
        className="h-8 max-w-48 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={activeWorkspaceId}
        id="workspace-selector"
        name="workspaceId"
      >
        {memberships.map((membership) => (
          <option key={membership.workspaceId} value={membership.workspaceId}>
            {membership.workspaceName} · {membership.role}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit" variant="outline">
        Switch
      </Button>
    </form>
  );
}
