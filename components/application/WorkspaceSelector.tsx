import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
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
    <form action={selectWorkspaceAction} className="space-y-2">
      <label className="sr-only" htmlFor="workspace-selector">
        Active workspace
      </label>
      <FormSelect
        defaultValue={activeWorkspaceId}
        id="workspace-selector"
        name="workspaceId"
      >
        {memberships.map((membership) => (
          <SelectItem
            key={membership.workspaceId}
            value={String(membership.workspaceId)}
          >
            {membership.workspaceName} · {membership.role}
          </SelectItem>
        ))}
      </FormSelect>
      <Button className="w-full" size="sm" type="submit" variant="outline">
        Switch
      </Button>
    </form>
  );
}
