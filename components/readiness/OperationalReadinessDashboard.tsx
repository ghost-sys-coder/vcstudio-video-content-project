import { ReadinessSection } from "@/components/readiness/ReadinessSection";
import type { ReadinessView } from "@/lib/readiness/readiness";
import { ReadinessOverview } from "./ReadinessOverview";

export function OperationalReadinessDashboard({
  view,
}: {
  view: ReadinessView;
}) {
  return (
    <div className="app-page font-[family-name:var(--font-geist-sans,Arial,sans-serif)]">
      <div className="app-heading">
        <p className="text-sm font-medium text-muted-foreground">
          Workspace operations
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Operational readiness
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          See what is ready, what needs attention and the next steps for your
          workspace. Credential values stay private.
        </p>
      </div>
      <ReadinessOverview view={view} />
      <div className="app-grid grid-cols-1 xl:grid-cols-2">
        <ReadinessSection
          title="Deployment"
          description="Configuration, schema, storage, and worker health for this environment."
          items={view.deployment}
        />
        <ReadinessSection
          title="Workspace"
          description="Authorizations and active workflow health scoped to this workspace."
          items={view.workspace}
        />
      </div>
    </div>
  );
}
