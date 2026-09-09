import { redirect } from "next/navigation";
import { WorkspaceProfilePage } from "@/components/workspace/WorkspaceProfilePage";
import {
  countProjectsByChannel,
  listChannelProfiles,
  listProjectsForChannel,
} from "@/db/repositories/channel-profiles.repository";
import { listCustomVoices } from "@/db/repositories/custom-voice.repository";
import { buildChannelProfileView } from "@/lib/channels/channel-profile-view";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import {
  listPendingWorkspaceInvitations,
  listWorkspaceMembers,
} from "@/db/repositories/workspaces.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { isMarketingStudioEnabledForWorkspace } from "@/lib/marketing/marketing-access";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";
import { loadWorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    tiktok?: string;
    x?: string;
    youtube?: string;
  }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const [
    { facebook, instagram, linkedin, tiktok, x, youtube },
    logo,
    channelsView,
    members,
    pendingInvitations,
    marketingStudioEnabled,
    customVoices,
    channelProfileRows,
    unassignedProjects,
    projectCountsByChannel,
  ] = await Promise.all([
    searchParams,
    findWorkspaceLogo(context.activeMembership.workspaceId),
    loadWorkspaceChannelsView({
      workspaceId: context.activeMembership.workspaceId,
    }),
    listWorkspaceMembers(context.activeMembership.workspaceId),
    listPendingWorkspaceInvitations(context.activeMembership.workspaceId),
    isMarketingStudioEnabledForWorkspace({
      workspaceId: context.activeMembership.workspaceId,
    }),
    listCustomVoices({ workspaceId: context.activeMembership.workspaceId }),
    listChannelProfiles({ workspaceId: context.activeMembership.workspaceId }),
    listProjectsForChannel({
      workspaceId: context.activeMembership.workspaceId,
      channelProfileId: null,
    }),
    countProjectsByChannel({
      workspaceId: context.activeMembership.workspaceId,
    }),
  ]);
  const logoUrl = logo
    ? await createWorkspaceLogoDownloadUrl(logo.objectKey)
    : null;

  return (
    <WorkspaceProfilePage
      canManageChannelProfiles={can(
        context.activeMembership.role,
        "manageChannelProfiles",
      )}
      channelProfiles={channelProfileRows.map((row) =>
        buildChannelProfileView({
          row,
          projectCount: projectCountsByChannel.get(row.profile.id) ?? 0,
        }),
      )}
      unassignedProjectCount={unassignedProjects.length}
      canManageCustomVoices={can(
        context.activeMembership.role,
        "manageCustomVoices",
      )}
      channelsView={channelsView}
      currentUserId={context.user.id}
      customVoices={customVoices.map((voice) => ({
        id: voice.id,
        name: voice.name,
        consentLanguage: voice.consentLanguage,
        status: voice.status,
        createdAt: voice.createdAt.toISOString(),
      }))}
      logoUrl={logoUrl}
      marketingDeploymentEnabled={
        getMarketingEnvironment().ENABLE_MARKETING_STUDIO
      }
      marketingStudioEnabled={marketingStudioEnabled}
      members={members}
      oauthStatus={{
        facebook: facebook ?? null,
        instagram: instagram ?? null,
        linkedin: linkedin ?? null,
        tiktok: tiktok ?? null,
        x: x ?? null,
        youtube: youtube ?? null,
      }}
      pendingInvitations={pendingInvitations}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
