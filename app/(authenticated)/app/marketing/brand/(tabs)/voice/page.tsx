import { BrandVoiceForm } from "@/components/marketing/BrandVoiceForm";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";

export default async function BrandVoicePage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const view = await loadBrandWorkspaceView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="pt-4">
      <BrandVoiceForm profile={view.profile} />
    </div>
  );
}
