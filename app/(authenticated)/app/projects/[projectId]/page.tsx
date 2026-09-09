import { notFound } from "next/navigation";
import { ProjectOverviewPageContent } from "@/components/projects/ProjectOverviewPageContent";
import { loadProjectProductionReadiness } from "@/db/repositories/production-queue.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

/**
 * The project overview.
 *
 * This route previously redirected straight to the script tab, which meant a
 * creator had to already know which of the eight tabs their work was in. It
 * now opens on where the project stands and what to do next. Every existing
 * tab route is unchanged, so earlier bookmarks still resolve exactly as before.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const readiness = await loadProjectProductionReadiness({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!readiness) notFound();
  return (
    <ProjectOverviewPageContent projectId={projectId} readiness={readiness} />
  );
}
