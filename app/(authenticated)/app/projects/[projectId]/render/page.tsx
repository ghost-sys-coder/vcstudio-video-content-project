import { notFound } from "next/navigation";
import { VideoPreviewWorkspace } from "@/components/render/VideoPreviewWorkspace";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
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
    <VideoPreviewWorkspace
      canRender={can(role, "renderVideo") && notArchived}
      initialData={data}
      projectId={project.id}
    />
  );
}
