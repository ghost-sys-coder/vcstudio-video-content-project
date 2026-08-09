import { ReadinessSection } from "@/components/readiness/ReadinessSection";
import type { ReadinessView } from "@/lib/readiness/readiness";

export function OperationalReadinessDashboard({
  view,
}: {
  view: ReadinessView;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Workspace operations
        </p>
        <h1 className="text-2xl font-semibold">Operational readiness</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configuration and authorization states are shown without credential
          values. Checked {view.checkedAt.toLocaleString()}.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
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
