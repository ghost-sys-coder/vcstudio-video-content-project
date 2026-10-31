import { MarketingStudioSection } from "@/components/workspace/MarketingStudioSection";
import { WorkspaceChannelProfilesSection } from "@/components/workspace/WorkspaceChannelProfilesSection";
import { WorkspaceCustomVoicesSection } from "@/components/workspace/WorkspaceCustomVoicesSection";
import { WorkspaceProfileForm } from "@/components/workspace/WorkspaceProfileForm";
import { WorkspaceStylePresetsSection } from "@/components/workspace/WorkspaceStylePresetsSection";
import { WorkspaceConnectionsLink } from "@/components/workspace/WorkspaceConnectionsLink";
import { WorkspaceMembersSection } from "@/components/workspace/WorkspaceMembersSection";
import type {
  WorkspaceInvitationView,
  WorkspaceMemberView,
} from "@/db/repositories/workspaces.repository";
import type { CustomVoiceSummary } from "@/lib/audio/custom-voice-client";
import type { ChannelProfileView } from "@/lib/channels/channel-profile-view";
import type { StylePresetSettingsView } from "@/lib/styles/style-preset-view";

export function WorkspaceProfilePage({
  canManageChannelProfiles,
  canManageCustomVoices,
  canManageStylePresets,
  channelProfiles,
  unassignedProjectCount,
  currentUserId,
  customVoices,
  logoUrl,
  marketingDeploymentEnabled,
  marketingStudioEnabled,
  members,
  pendingInvitations,
  stylePresets,
  workspaceId,
  workspaceName,
}: {
  canManageChannelProfiles: boolean;
  canManageCustomVoices: boolean;
  canManageStylePresets: boolean;
  channelProfiles: ChannelProfileView[];
  unassignedProjectCount: number;
  currentUserId: string;
  customVoices: CustomVoiceSummary[];
  logoUrl: string | null;
  marketingDeploymentEnabled: boolean;
  marketingStudioEnabled: boolean;
  members: WorkspaceMemberView[];
  pendingInvitations: WorkspaceInvitationView[];
  stylePresets: StylePresetSettingsView[];
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <section className="app-page app-form-page">
      <div className="app-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Workspace settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Workspace profile
        </h1>
        <p className="text-muted-foreground">
          Update the name and visual identity shown across VCStudio.
        </p>
      </div>
      <div className="app-panel rounded-2xl border bg-background shadow-sm">
        <WorkspaceProfileForm
          logoUrl={logoUrl}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>
      <div>
        <MarketingStudioSection
          deploymentEnabled={marketingDeploymentEnabled}
          enabled={marketingStudioEnabled}
        />
      </div>
      <div>
        <WorkspaceConnectionsLink />
      </div>
      <div>
        <WorkspaceChannelProfilesSection
          canManage={canManageChannelProfiles}
          channels={channelProfiles}
          unassignedProjectCount={unassignedProjectCount}
        />
      </div>
      <div>
        <WorkspaceStylePresetsSection
          canManage={canManageStylePresets}
          presets={stylePresets}
        />
      </div>
      <div>
        <WorkspaceCustomVoicesSection
          canManage={canManageCustomVoices}
          initialVoices={customVoices}
        />
      </div>
      <div>
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
