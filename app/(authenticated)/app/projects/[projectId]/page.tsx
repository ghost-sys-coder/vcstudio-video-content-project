import { notFound } from "next/navigation";
import { ProjectOverviewPageContent } from "@/components/projects/ProjectOverviewPageContent";
import { loadProjectProductionReadiness } from "@/db/repositories/production-queue.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { listVoicePresets } from "@/db/repositories/scene-audio.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { loadProductionRunPanel } from "@/lib/production-runs/production-run-view";

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
  const workspaceId = context.activeMembership.workspaceId;
  const [readiness, project, panel, voicePresets] = await Promise.all([
    loadProjectProductionReadiness({ workspaceId, projectId }),
    findProject({ workspaceId, projectId }),
    loadProductionRunPanel({ workspaceId, projectId }),
    listVoicePresets({ workspaceId }),
  ]);
  if (!readiness || !project) notFound();
  return (
    <ProjectOverviewPageContent
      canRunProduction={can(context.activeMembership.role, "runProduction")}
      productionRun={panel}
      projectBudgetCents={project.maximumBudgetCents}
      projectId={projectId}
      readiness={readiness}
      voicePresets={voicePresets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        isDefault: preset.isDefault,
      }))}
    />
  );
}
