import { ProjectListPageContent } from "@/components/projects/ProjectListPageContent";
import { listProjects } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProjectEnvironment } from "@/lib/env/server";
import { canCreateProject } from "@/lib/policies/workspace-policy";
import { projectListQuerySchema } from "@/lib/schemas/project";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const query = projectListQuerySchema.parse(await searchParams);
  const result = await listProjects({
    workspaceId: context.activeMembership.workspaceId,
    ...query,
  });
  return (
    <ProjectListPageContent
      canCreate={canCreateProject(context.activeMembership.role)}
      defaultBudgetCents={getProjectEnvironment().DEFAULT_PROJECT_BUDGET_CENTS}
      page={result.page}
      pageCount={result.pageCount}
      projects={result.items}
    />
  );
}
