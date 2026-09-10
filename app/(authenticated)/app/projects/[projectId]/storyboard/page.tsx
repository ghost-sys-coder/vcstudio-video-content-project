import { notFound } from "next/navigation";
import { Storyboard } from "@/components/storyboard/Storyboard";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import {
  readSceneWorkspaceState,
  type SearchParamsInput,
} from "@/lib/production/scene-workspace-state";
import { loadStoryboard } from "@/lib/scenes/storyboard-details";

export default async function ProjectStoryboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const workspaceState = readSceneWorkspaceState(await searchParams);
  const workspaceId = context.activeMembership.workspaceId;
  const project = await findProject({ workspaceId, projectId });
  if (!project) notFound();

  const storyboard = await loadStoryboard({ workspaceId, project });
  const notArchived = project.status !== "archived";

  return (
    <Storyboard
      canGenerate={
        can(context.activeMembership.role, "generateSceneImages") && notArchived
      }
      canReview={
        can(context.activeMembership.role, "reviewSceneImages") && notArchived
      }
      initialData={storyboard}
      initialState={workspaceState}
      projectId={project.id}
    />
  );
}
