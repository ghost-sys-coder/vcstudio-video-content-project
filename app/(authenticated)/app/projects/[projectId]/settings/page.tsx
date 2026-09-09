import { notFound } from "next/navigation";
import { ProjectDangerZone } from "@/components/projects/ProjectDangerZone";
import { ProjectChannelSection } from "@/components/projects/ProjectChannelSection";
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm";
import { listChannelProfiles } from "@/db/repositories/channel-profiles.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { buildChannelProfileView } from "@/lib/channels/channel-profile-view";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectStatusTransitions } from "@/lib/domain/project-status";
import {
  canDeleteProject,
  canEditProject,
} from "@/lib/policies/workspace-policy";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId: (await params).projectId,
  });
  if (!project) notFound();
  const channelRows = await listChannelProfiles({
    workspaceId: context.activeMembership.workspaceId,
  });
  return (
    <div className="space-y-8">
      <ProjectSettingsForm
        allowedStatuses={[
          project.status,
          ...getProjectStatusTransitions(project.status),
        ]}
        canEdit={
          canEditProject(context.activeMembership.role) &&
          project.status !== "archived"
        }
        project={project}
      />
      <ProjectChannelSection
        canEdit={
          canEditProject(context.activeMembership.role) &&
          project.status !== "archived"
        }
        channels={channelRows.map((row) => {
          const view = buildChannelProfileView({ row, projectCount: 0 });
          return {
            id: view.id,
            name: view.name,
            platform: view.platform,
            canPublish: view.canPublish,
          };
        })}
        projectId={project.id}
        selectedChannelId={project.channelProfileId}
      />
      {/* Deliberately not gated on `project.status !== "archived"` like the
          settings form: an archived project is exactly the one most likely to
          be deleted for its storage. */}
      <ProjectDangerZone
        canDelete={canDeleteProject(context.activeMembership.role)}
        projectId={project.id}
        projectName={project.name}
      />
    </div>
  );
}
