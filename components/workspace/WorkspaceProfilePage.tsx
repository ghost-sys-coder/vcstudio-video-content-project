import { WorkspaceProfileForm } from "@/components/workspace/WorkspaceProfileForm";
import { WorkspaceChannelsSection } from "@/components/workspace/WorkspaceChannelsSection";
import type { WorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";

export function WorkspaceProfilePage({
  channelsView,
  logoUrl,
  oauthStatus,
  workspaceId,
  workspaceName,
}: {
  channelsView: WorkspaceChannelsView;
  logoUrl: string | null;
  oauthStatus: string | null;
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <section className="mx-auto max-w-4xl">
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
      <div className="mt-6">
        <WorkspaceChannelsSection
          initialData={channelsView}
          oauthStatus={oauthStatus}
        />
      </div>
    </section>
  );
}
