import { notFound } from "next/navigation";
import { BriefForm } from "@/components/projects/BriefForm";
import { EditorialReviewPanel } from "@/components/projects/EditorialReviewPanel";
import { GenerateScriptPanel } from "@/components/projects/GenerateScriptPanel";
import { ScriptEditor } from "@/components/projects/ScriptEditor";
import {
  findProject,
  findProjectScriptDraft,
  listProjectScriptVersions,
} from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { canEditProject } from "@/lib/policies/workspace-policy";
import { loadScriptGenerationView } from "@/lib/scripts/script-generation-view";
import { findClaimCandidates } from "@/lib/editorial/claim-candidates";
import { loadEditorialReviewView } from "@/lib/editorial/editorial-review-view";

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
  const [project, draft, versions, brief] = await Promise.all([
    findProject(scope),
    findProjectScriptDraft(scope),
    listProjectScriptVersions(scope),
    findProjectBrief(scope),
  ]);
  if (!project || !draft) notFound();
  const canEdit =
    canEditProject(context.activeMembership.role) &&
    project.status !== "archived";
  const [scriptGenerationView, editorialReview] = await Promise.all([
    loadScriptGenerationView({
      workspaceId: scope.workspaceId,
      project,
      brief,
    }),
    loadEditorialReviewView({ ...scope, draftContent: draft.content }),
  ]);
  const claimCandidates = findClaimCandidates(draft.content);
  return (
    <div className="space-y-6">
      <BriefForm brief={brief} canEdit={canEdit} projectId={project.id} />
      <GenerateScriptPanel
        canEdit={canEdit}
        estimatedCostCents={scriptGenerationView.estimatedCostCents}
        hasBriefTopic={scriptGenerationView.hasBriefTopic}
        initialLatestRun={scriptGenerationView.latestRun}
        model={scriptGenerationView.model}
        projectId={project.id}
        requireHistoricalAccuracy={
          scriptGenerationView.requireHistoricalAccuracy
        }
      />
      <ScriptEditor
        key={`${context.user.id}:${scope.workspaceId}:${project.id}:${canEdit}`}
        userId={context.user.id}
        canEdit={canEdit}
        draft={draft}
        maximumCharacters={getProjectEnvironment().MAX_SCRIPT_CHARACTERS}
        versions={versions}
      />
      <EditorialReviewPanel
        canEdit={canEdit}
        candidates={claimCandidates}
        projectId={project.id}
        view={editorialReview}
      />
    </div>
  );
}
