import { notFound } from "next/navigation";
import { BriefForm } from "@/components/projects/BriefForm";
import { GenerateScriptPanel } from "@/components/projects/GenerateScriptPanel";
import { ScriptEditor } from "@/components/projects/ScriptEditor";
import { StartFromIdeaSelect } from "@/components/projects/StartFromIdeaSelect";
import {
  findProject,
  findProjectScriptDraft,
  listProjectScriptVersions,
} from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { loadIdeaPickerGroups } from "@/lib/ideas/ideas-view";
import { canEditProject } from "@/lib/policies/workspace-policy";
import { loadScriptGenerationView } from "@/lib/scripts/script-generation-view";

export default async function ProjectScriptPage({
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
  const [project, draft, versions, brief, ideaGroups] = await Promise.all([
    findProject(scope),
    findProjectScriptDraft(scope),
    listProjectScriptVersions(scope),
    findProjectBrief(scope),
    loadIdeaPickerGroups({ workspaceId: scope.workspaceId }),
  ]);
  if (!project || !draft) notFound();
  const canEdit =
    canEditProject(context.activeMembership.role) &&
    project.status !== "archived";
  const scriptGenerationView = await loadScriptGenerationView({
    workspaceId: scope.workspaceId,
    project,
    brief,
  });
  return (
    <div className="space-y-6">
      <StartFromIdeaSelect
        canEdit={canEdit}
        groups={ideaGroups}
        projectId={project.id}
      />
      <BriefForm brief={brief} canEdit={canEdit} projectId={project.id} />
      <GenerateScriptPanel
        canEdit={canEdit}
        estimatedCostCents={scriptGenerationView.estimatedCostCents}
        hasBriefTopic={scriptGenerationView.hasBriefTopic}
        initialLatestRun={scriptGenerationView.latestRun}
        model={scriptGenerationView.model}
        projectId={project.id}
      />
      <ScriptEditor
        canEdit={canEdit}
        draft={draft}
        maximumCharacters={getProjectEnvironment().MAX_SCRIPT_CHARACTERS}
        versions={versions}
      />
    </div>
  );
}
