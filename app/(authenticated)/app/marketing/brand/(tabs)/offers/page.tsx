import { BrandOfferDialog } from "@/components/marketing/BrandOfferDialog";
import { BrandOfferRow } from "@/components/marketing/BrandOfferRow";
import { EmptyBrandListState } from "@/components/marketing/EmptyBrandListState";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";

export default async function BrandOffersPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const view = await loadBrandWorkspaceView({
    workspaceId: context.activeMembership.workspaceId,
  });

  const audienceNames = new Map(
    view.audiences.map((audience) => [audience.id, audience.name]),
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          What you sell. The studio will not invent a product that is not listed
          here.
        </p>
        <BrandOfferDialog audiences={view.audiences} />
      </div>

      {view.offers.length === 0 ? (
        <EmptyBrandListState
          description="List what you sell so generated content can point at something real. Anything absent from this list is something the studio has been told not to claim you offer."
          title="Nothing listed yet"
        />
      ) : (
        <ul className="space-y-2">
          {view.offers.map((offer) => (
            <BrandOfferRow
              audienceName={
                offer.audienceId
                  ? (audienceNames.get(offer.audienceId) ?? null)
                  : null
              }
              audiences={view.audiences}
              key={offer.id}
              offer={offer}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
