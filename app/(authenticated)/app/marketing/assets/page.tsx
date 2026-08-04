import { AssignBrandAssetDialog } from "@/components/marketing/AssignBrandAssetDialog";
import { BrandAssetCard } from "@/components/marketing/BrandAssetCard";
import { EmptyBrandListState } from "@/components/marketing/EmptyBrandListState";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingAssetsView } from "@/lib/marketing/documents/documents-view";
import { loadMediaLibrary } from "@/lib/media/load-media-library";

export default async function MarketingBrandAssetsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const { workspaceId } = context.activeMembership;
  const [view, library] = await Promise.all([
    loadMarketingAssetsView({ workspaceId }),
    loadMediaLibrary({ workspaceId, kind: "image" }),
  ]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Files from the media library, tagged with what they are, so generated
          graphics use the right logo.
        </p>
        <AssignBrandAssetDialog library={library.assets} />
      </div>

      {view.brandAssets.length === 0 ? (
        <EmptyBrandListState
          description="Tag a logo, a product shot, or anything else the studio should design with. Files stay in the media library — this only records what each one is."
          title="No brand assets tagged yet"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {view.brandAssets.map((asset) => (
            <BrandAssetCard asset={asset} key={asset.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
