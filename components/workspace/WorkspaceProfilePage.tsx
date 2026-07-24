import { WorkspaceProfileForm } from "@/components/workspace/WorkspaceProfileForm";
import { WorkspaceChannelsSection } from "@/components/workspace/WorkspaceChannelsSection";
import { WorkspaceMembersSection } from "@/components/workspace/WorkspaceMembersSection";
import type {
  WorkspaceInvitationView,
  WorkspaceMemberView,
} from "@/db/repositories/workspaces.repository";
import type { WorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";

export function WorkspaceProfilePage({
  channelsView,
  currentUserId,
  logoUrl,
  members,
  oauthStatus,
  pendingInvitations,
  workspaceId,
  workspaceName,
}: {
  channelsView: WorkspaceChannelsView;
  currentUserId: string;
  logoUrl: string | null;
  members: WorkspaceMemberView[];
  oauthStatus: {
    facebook: string | null;
    instagram: string | null;
    tiktok: string | null;
    youtube: string | null;
  };
  pendingInvitations: WorkspaceInvitationView[];
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Workspace settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Workspace profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update the name and visual identity shown across VCStudio.
        </p>
      </div>
      <div className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <WorkspaceProfileForm
          logoUrl={logoUrl}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>
      <div className="mt-6">
        <WorkspaceChannelsSection
          initialData={channelsView}
          oauthStatus={oauthStatus}
        />
      </div>
      <div className="mt-6">
        <WorkspaceMembersSection
          currentUserId={currentUserId}
          members={members}
          pendingInvitations={pendingInvitations}
          workspaceId={workspaceId}
        />
      </div>
    </section>
  );
}
