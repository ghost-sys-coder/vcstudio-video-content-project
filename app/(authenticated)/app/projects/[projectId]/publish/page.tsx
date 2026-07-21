import { notFound } from "next/navigation";
import { PlatformThumbnailsPanel } from "@/components/publish/PlatformThumbnailsPanel";
import { PlatformTitlesPanel } from "@/components/publish/PlatformTitlesPanel";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { canEditProject } from "@/lib/policies/workspace-policy";
import { loadThumbnailsView } from "@/lib/thumbnails/thumbnail-view";
import { loadTitlesView } from "@/lib/titles/title-view";

export default async function ProjectPublishPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const scope = {
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  };
  const [project, brief] = await Promise.all([
    findProject(scope),
    findProjectBrief(scope),
  ]);
  if (!project) notFound();
  const canGenerate =
    canEditProject(context.activeMembership.role) &&
    project.status !== "archived";
  const [titlesView, thumbnailsView] = await Promise.all([
    loadTitlesView({ workspaceId: scope.workspaceId, project, brief }),
    loadThumbnailsView({ workspaceId: scope.workspaceId, project, brief }),
  ]);
  return (
    <div className="space-y-6">
      <PlatformTitlesPanel
        canGenerate={canGenerate}
        initialData={titlesView}
        projectId={project.id}
      />
      <PlatformThumbnailsPanel
        canGenerate={canGenerate}
        initialData={thumbnailsView}
        projectId={project.id}
      />
    </div>
  );
}
