import { MarketingStudioSection } from "@/components/workspace/MarketingStudioSection";
import { WorkspaceChannelProfilesSection } from "@/components/workspace/WorkspaceChannelProfilesSection";
import { WorkspaceCustomVoicesSection } from "@/components/workspace/WorkspaceCustomVoicesSection";
import { WorkspaceProfileForm } from "@/components/workspace/WorkspaceProfileForm";
import { WorkspaceStylePresetsSection } from "@/components/workspace/WorkspaceStylePresetsSection";
import { WorkspaceChannelsSection } from "@/components/workspace/WorkspaceChannelsSection";
import { WorkspaceMembersSection } from "@/components/workspace/WorkspaceMembersSection";
import type {
  WorkspaceInvitationView,
  WorkspaceMemberView,
} from "@/db/repositories/workspaces.repository";
import type { CustomVoiceSummary } from "@/lib/audio/custom-voice-client";
import type { ChannelProfileView } from "@/lib/channels/channel-profile-view";
import type { WorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";
import type { StylePresetSettingsView } from "@/lib/styles/style-preset-view";

export function WorkspaceProfilePage({
  canManageChannelProfiles,
  canManageCustomVoices,
  canManageStylePresets,
  channelProfiles,
  unassignedProjectCount,
  channelsView,
  currentUserId,
  customVoices,
  logoUrl,
  marketingDeploymentEnabled,
  marketingStudioEnabled,
  members,
  oauthStatus,
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
  channelsView: WorkspaceChannelsView;
  currentUserId: string;
  customVoices: CustomVoiceSummary[];
  logoUrl: string | null;
  marketingDeploymentEnabled: boolean;
  marketingStudioEnabled: boolean;
  members: WorkspaceMemberView[];
  oauthStatus: {
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    tiktok: string | null;
    x: string | null;
    youtube: string | null;
  };
  pendingInvitations: WorkspaceInvitationView[];
  stylePresets: StylePresetSettingsView[];
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
        <MarketingStudioSection
          deploymentEnabled={marketingDeploymentEnabled}
          enabled={marketingStudioEnabled}
        />
      </div>
      <div className="mt-6">
        <WorkspaceChannelsSection
          initialData={channelsView}
          oauthStatus={oauthStatus}
        />
      </div>
      <div className="mt-6">
        <WorkspaceChannelProfilesSection
          canManage={canManageChannelProfiles}
          channels={channelProfiles}
          unassignedProjectCount={unassignedProjectCount}
        />
      </div>
      <div className="mt-6">
        <WorkspaceStylePresetsSection
          canManage={canManageStylePresets}
          presets={stylePresets}
        />
      </div>
      <div className="mt-6">
        <WorkspaceCustomVoicesSection
          canManage={canManageCustomVoices}
          initialVoices={customVoices}
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
