import { WorkspaceProfileForm } from "@/components/workspace/WorkspaceProfileForm";

export function WorkspaceProfilePage({
  logoUrl,
  workspaceId,
  workspaceName,
}: {
  logoUrl: string | null;
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Workspace settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Workspace profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update the name and visual identity shown across VCStudio.
        </p>
      </div>
      <div className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <WorkspaceProfileForm
          logoUrl={logoUrl}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>
    </section>
  );
}
