import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";

export function DashboardPlaceholder({
  membership,
}: {
  membership: WorkspaceMembershipView;
}) {
  return (
    <section aria-labelledby="dashboard-heading" className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {membership.role} workspace
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight"
          id="dashboard-heading"
        >
          {membership.workspaceName}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Your production workspace is ready. Project and generation features
          will arrive in the next implementation phases.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Projects", "0", "No projects created"],
          ["Active workflows", "0", "No work in progress"],
          ["Approved exports", "0", "No rendered videos"],
        ].map(([label, value, detail]) => (
          <article className="rounded-xl border bg-background p-5" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-5 font-mono text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
