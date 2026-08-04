import { BrandAudienceDialog } from "@/components/marketing/BrandAudienceDialog";
import { BrandAudienceRow } from "@/components/marketing/BrandAudienceRow";
import { EmptyBrandListState } from "@/components/marketing/EmptyBrandListState";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";

export default async function BrandAudiencesPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const view = await loadBrandWorkspaceView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          The primary audience is the one the studio writes for unless told
          otherwise.
        </p>
        <BrandAudienceDialog />
      </div>

      {view.audiences.length === 0 ? (
        <EmptyBrandListState
          description="Add at least one so generated content has somebody to talk to. Without an audience the studio writes for nobody in particular, which reads exactly like it sounds."
          title="No audiences yet"
        />
      ) : (
        <ul className="space-y-2">
          {view.audiences.map((audience) => (
            <BrandAudienceRow audience={audience} key={audience.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
