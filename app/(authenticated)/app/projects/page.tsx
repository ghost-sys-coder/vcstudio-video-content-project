import { ProjectListPageContent } from "@/components/projects/ProjectListPageContent";
import { listProjects } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { loadIdeaPickerGroups } from "@/lib/ideas/ideas-view";
import { canCreateProject } from "@/lib/policies/workspace-policy";
import { projectListQuerySchema } from "@/lib/schemas/project";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const params = await searchParams;
  const query = projectListQuerySchema.parse(params);
  const canCreate = canCreateProject(context.activeMembership.role);
  const [result, ideaGroups] = await Promise.all([
    listProjects({
      workspaceId: context.activeMembership.workspaceId,
      ...query,
    }),
    canCreate
      ? loadIdeaPickerGroups({
          workspaceId: context.activeMembership.workspaceId,
        })
      : Promise.resolve([]),
  ]);
  return (
    <ProjectListPageContent
      canCreate={canCreate}
      defaultBudgetCents={getProjectEnvironment().DEFAULT_PROJECT_BUDGET_CENTS}
      ideaGroups={ideaGroups}
      initialIdeaId={firstValue(params.ideaId) ?? null}
      page={result.page}
      pageCount={result.pageCount}
      projects={result.items}
      total={result.total}
    />
  );
}
