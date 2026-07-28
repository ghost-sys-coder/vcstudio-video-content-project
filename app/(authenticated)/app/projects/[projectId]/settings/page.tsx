import { notFound } from "next/navigation";
import { ProjectDangerZone } from "@/components/projects/ProjectDangerZone";
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm";
import { findProject } from "@/db/repositories/projects.repository";
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
