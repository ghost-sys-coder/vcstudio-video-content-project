import { ProjectListPageContent } from "@/components/projects/ProjectListPageContent";
import { listFormatPresets } from "@/db/repositories/format-presets.repository";
import { toFormatChoices } from "@/lib/formats/format-choice";
import { listProjects } from "@/db/repositories/projects.repository";
import { listLatestStylePresetVersions } from "@/db/repositories/scene-images.repository";
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
  const [result, ideaGroups, formatRows, stylePresetRows] = await Promise.all([
    listProjects({
      workspaceId: context.activeMembership.workspaceId,
      ...query,
    }),
    canCreate
      ? loadIdeaPickerGroups({
          workspaceId: context.activeMembership.workspaceId,
        })
      : Promise.resolve([]),
    canCreate
      ? listFormatPresets({
          workspaceId: context.activeMembership.workspaceId,
        })
      : Promise.resolve([]),
    canCreate
      ? listLatestStylePresetVersions({
          workspaceId: context.activeMembership.workspaceId,
        })
      : Promise.resolve([]),
  ]);
  const formatChoices = toFormatChoices(formatRows);
  return (
    <ProjectListPageContent
      formats={formatChoices}
      canCreate={canCreate}
      defaultBudgetCents={getProjectEnvironment().DEFAULT_PROJECT_BUDGET_CENTS}
      ideaGroups={ideaGroups}
      initialIdeaId={firstValue(params.ideaId) ?? null}
      page={result.page}
      pageCount={result.pageCount}
      projects={result.items}
      styles={stylePresetRows.map(({ preset, version }) => ({
        id: preset.id,
        versionId: version.id,
        name: version.name,
        description: version.description,
        version: version.version,
        isDefault: preset.isDefault,
        positivePrompt: version.positivePrompt,
        negativePrompt: version.negativePrompt,
        defaultAspectRatio: version.defaultAspectRatio,
      }))}
      total={result.total}
    />
  );
}
