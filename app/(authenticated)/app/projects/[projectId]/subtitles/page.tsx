import { notFound } from "next/navigation";
import { SubtitleWorkspace } from "@/components/subtitles/SubtitleWorkspace";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadSubtitleWorkspace } from "@/lib/subtitles/subtitle-workspace-details";
import { can } from "@/lib/policies/workspace-policy";

export default async function ProjectSubtitlesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const workspaceId = context.activeMembership.workspaceId;
  const project = await findProject({ workspaceId, projectId });
  if (!project) notFound();

  const subtitles = await loadSubtitleWorkspace({ workspaceId, project });
  const notArchived = project.status !== "archived";
  const role = context.activeMembership.role;

  return (
    <SubtitleWorkspace
      canManage={can(role, "manageSubtitles") && notArchived}
      initialData={subtitles}
      projectId={project.id}
    />
  );
}
