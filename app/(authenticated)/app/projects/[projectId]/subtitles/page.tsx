import { notFound } from "next/navigation";
import { WorkspaceViewSwitch } from "@/components/production/WorkspaceViewSwitch";
import { SubtitleWorkspace } from "@/components/subtitles/SubtitleWorkspace";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { ASSEMBLY_WORKSPACE_VIEWS } from "@/lib/production/workspace-views";
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
    <div className="min-w-0 max-w-full space-y-5">
      <WorkspaceViewSwitch
        activeViewId="captions"
        projectId={project.id}
        views={ASSEMBLY_WORKSPACE_VIEWS}
      />
      <SubtitleWorkspace
        canManage={can(role, "manageSubtitles") && notArchived}
        initialData={subtitles}
        projectId={project.id}
      />
    </div>
  );
}
