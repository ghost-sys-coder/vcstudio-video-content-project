import { notFound } from "next/navigation";
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectStatusTransitions } from "@/lib/domain/project-status";
import { canEditProject } from "@/lib/policies/workspace-policy";

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
  );
}
