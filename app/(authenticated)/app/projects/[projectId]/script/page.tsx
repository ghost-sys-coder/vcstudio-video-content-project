import { notFound } from "next/navigation";
import { ScriptEditor } from "@/components/projects/ScriptEditor";
import {
  findProject,
  findProjectScriptDraft,
  listProjectScriptVersions,
} from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { canEditProject } from "@/lib/policies/workspace-policy";

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
  const [project, draft, versions] = await Promise.all([
    findProject(scope),
    findProjectScriptDraft(scope),
    listProjectScriptVersions(scope),
  ]);
  if (!project || !draft) notFound();
  return (
    <ScriptEditor
      canEdit={
        canEditProject(context.activeMembership.role) &&
        project.status !== "archived"
      }
      draft={draft}
      maximumCharacters={getProjectEnvironment().MAX_SCRIPT_CHARACTERS}
      versions={versions}
    />
  );
}
