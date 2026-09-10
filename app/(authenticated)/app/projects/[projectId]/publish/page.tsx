import { notFound } from "next/navigation";
import { PlatformThumbnailsPanel } from "@/components/publish/PlatformThumbnailsPanel";
import { PlatformTitlesPanel } from "@/components/publish/PlatformTitlesPanel";
import { PublishToPlatformPanel } from "@/components/publish/PublishToPlatformPanel";
import { ReleasePackagePanel } from "@/components/publish/ReleasePackagePanel";
import { ShareRenderAsPostPanel } from "@/components/publish/ShareRenderAsPostPanel";
import { loadPublishingView } from "@/lib/publishing/publishing-view";
import { listReleaseSchedules } from "@/db/repositories/release-schedules.repository";
import { toReleaseScheduleListView } from "@/lib/releases/release-schedule-view";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  can,
  canEditProject,
  canManageWorkspace,
} from "@/lib/policies/workspace-policy";
import { loadReleasePackagesView } from "@/lib/releases/release-package-view";
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
  const scheduleRows = await listReleaseSchedules({
    workspaceId: scope.workspaceId,
    projectId,
  });
  const [titlesView, thumbnailsView, publishingView, releasePackagesView] =
    await Promise.all([
      loadTitlesView({ workspaceId: scope.workspaceId, project, brief }),
      loadThumbnailsView({ workspaceId: scope.workspaceId, project, brief }),
      loadPublishingView({ workspaceId: scope.workspaceId, project }),
      loadReleasePackagesView({ workspaceId: scope.workspaceId, project }),
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
      <ReleasePackagePanel
        canEdit={canGenerate}
        initialData={releasePackagesView}
        projectId={project.id}
        thumbnails={thumbnailsView}
        titles={titlesView}
      />
      <PublishToPlatformPanel
        canManageConnections={canManageWorkspace(context.activeMembership.role)}
        canPublish={canGenerate}
        initialData={publishingView}
        projectId={project.id}
        initialSchedules={toReleaseScheduleListView(scheduleRows)}
        releasePackages={releasePackagesView}
      />
      <ShareRenderAsPostPanel
        canCompose={can(context.activeMembership.role, "composePosts")}
        canManageConnections={canManageWorkspace(context.activeMembership.role)}
        data={publishingView}
        projectId={project.id}
      />
    </div>
  );
}
