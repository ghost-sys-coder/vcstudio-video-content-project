import { redirect } from "next/navigation";
import { WorkspaceProfilePage } from "@/components/workspace/WorkspaceProfilePage";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import {
  listPendingWorkspaceInvitations,
  listWorkspaceMembers,
} from "@/db/repositories/workspaces.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";
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
    youtube?: string;
  }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const [
    { facebook, instagram, linkedin, tiktok, youtube },
    logo,
    channelsView,
    members,
    pendingInvitations,
  ] = await Promise.all([
    searchParams,
    findWorkspaceLogo(context.activeMembership.workspaceId),
    loadWorkspaceChannelsView({
      workspaceId: context.activeMembership.workspaceId,
    }),
    listWorkspaceMembers(context.activeMembership.workspaceId),
    listPendingWorkspaceInvitations(context.activeMembership.workspaceId),
  ]);
  const logoUrl = logo
    ? await createWorkspaceLogoDownloadUrl(logo.objectKey)
    : null;

  return (
    <WorkspaceProfilePage
      channelsView={channelsView}
      currentUserId={context.user.id}
      logoUrl={logoUrl}
      members={members}
      oauthStatus={{
        facebook: facebook ?? null,
        instagram: instagram ?? null,
        linkedin: linkedin ?? null,
        tiktok: tiktok ?? null,
        youtube: youtube ?? null,
      }}
      pendingInvitations={pendingInvitations}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
