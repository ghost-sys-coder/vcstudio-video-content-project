import { notFound } from "next/navigation";
import { WorkspaceViewSwitch } from "@/components/production/WorkspaceViewSwitch";
import { VideoPreviewWorkspace } from "@/components/render/VideoPreviewWorkspace";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { getSubtitleEnvironment } from "@/lib/env/server";
import { ASSEMBLY_WORKSPACE_VIEWS } from "@/lib/production/workspace-views";
import { loadRenderWorkspace } from "@/lib/render/render-workspace-details";

export default async function ProjectRenderPage({
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

  const data = await loadRenderWorkspace({ workspaceId, project });
  const notArchived = project.status !== "archived";
  const role = context.activeMembership.role;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <WorkspaceViewSwitch
        activeViewId="preview"
        projectId={project.id}
        views={ASSEMBLY_WORKSPACE_VIEWS}
      />
      <VideoPreviewWorkspace
        canRender={can(role, "renderVideo") && notArchived}
        captionsEnabled={getSubtitleEnvironment().ENABLE_SUBTITLES}
        initialData={data}
        projectId={project.id}
      />
    </div>
  );
}
