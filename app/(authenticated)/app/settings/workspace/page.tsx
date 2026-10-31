import { redirect } from "next/navigation";
import { WorkspaceProfilePage } from "@/components/workspace/WorkspaceProfilePage";
import {
  countProjectsByChannel,
  listChannelProfiles,
  listProjectsForChannel,
} from "@/db/repositories/channel-profiles.repository";
import { listCustomVoices } from "@/db/repositories/custom-voice.repository";
import { listLatestStylePresetVersions } from "@/db/repositories/scene-images.repository";
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
import { getLegacyConnectionsRedirect } from "@/lib/publishing/connections-navigation";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";
import { buildStylePresetSettingsView } from "@/lib/styles/style-preset-view";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const connectionsRedirect = getLegacyConnectionsRedirect(await searchParams);
  if (connectionsRedirect) redirect(connectionsRedirect);

  const [
    logo,
    members,
    pendingInvitations,
    marketingStudioEnabled,
    customVoices,
    channelProfileRows,
    unassignedProjects,
    projectCountsByChannel,
    stylePresetRows,
  ] = await Promise.all([
    findWorkspaceLogo(context.activeMembership.workspaceId),
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
    // Archived styles are included so the settings screen can offer restoring
    // one; the generate dialog loads the same list without them.
    listLatestStylePresetVersions({
      workspaceId: context.activeMembership.workspaceId,
      includeArchived: true,
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
      canManageStylePresets={can(
        context.activeMembership.role,
        "manageStylePresets",
      )}
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
      pendingInvitations={pendingInvitations}
      stylePresets={stylePresetRows.map(buildStylePresetSettingsView)}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
