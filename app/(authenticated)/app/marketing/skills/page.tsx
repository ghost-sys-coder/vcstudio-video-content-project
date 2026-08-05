import { notFound } from "next/navigation";
import { MarketingSkillCard } from "@/components/marketing/MarketingSkillCard";
import { MarketingSkillForm } from "@/components/marketing/MarketingSkillForm";
import { listMarketingSkills } from "@/db/repositories/marketing-skills.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";

export default async function MarketingSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  if (!can(context.activeMembership.role, "manageMarketingSkills")) notFound();
  const [skills, query] = await Promise.all([
    listMarketingSkills({ workspaceId: context.activeMembership.workspaceId }),
    searchParams,
  ]);
  const editing = skills.find((skill) => skill.id === query.edit);
  return (
    <div className="space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Custom skills</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Turn repeatable writing briefs into slash commands. Custom skills use
          the existing text executors, budget controls, brand context, and
          review queue. They cannot invoke research, imagery, video, or tools.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-medium">
          {editing ? `Edit ${editing.name}` : "New custom skill"}
        </h2>
        <MarketingSkillForm skill={editing} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Workspace skills</h2>
        {skills.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {skills.map((skill) => (
              <MarketingSkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No custom skills yet. Create one above, then type / in Marketing
            Chat to use it.
          </p>
        )}
      </section>
    </div>
  );
}
