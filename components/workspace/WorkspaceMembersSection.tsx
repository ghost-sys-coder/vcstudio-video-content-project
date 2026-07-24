import { InviteMemberDialog } from "@/components/workspace/InviteMemberDialog";
import { PendingInvitationRow } from "@/components/workspace/PendingInvitationRow";
import { WorkspaceMemberRow } from "@/components/workspace/WorkspaceMemberRow";
import type {
  WorkspaceInvitationView,
  WorkspaceMemberView,
} from "@/db/repositories/workspaces.repository";

export function WorkspaceMembersSection({
  currentUserId,
  members,
  pendingInvitations,
  workspaceId,
}: {
  currentUserId: string;
  members: WorkspaceMemberView[];
  pendingInvitations: WorkspaceInvitationView[];
  workspaceId: string;
}) {
  const ownerCount = members.filter((member) => member.role === "owner").length;

  return (
    <div className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite teammates and manage who can access this workspace.
          </p>
        </div>
        <InviteMemberDialog workspaceId={workspaceId} />
      </div>

      <ul className="mt-6">
        {members.map((member) => (
          <WorkspaceMemberRow
            isSelf={member.userId === currentUserId}
            isSoleOwner={member.role === "owner" && ownerCount <= 1}
            key={member.membershipId}
            member={member}
            workspaceId={workspaceId}
          />
        ))}
      </ul>

      {pendingInvitations.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending invitations
          </h3>
          <ul className="mt-3">
            {pendingInvitations.map((invitation) => (
              <PendingInvitationRow
                invitation={invitation}
                key={invitation.id}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
