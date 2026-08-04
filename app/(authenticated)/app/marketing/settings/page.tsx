import Link from "next/link";
import { MarketingSettingsForm } from "@/components/marketing/MarketingSettingsForm";
import { Button } from "@/components/ui/button";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";

export default async function MarketingSettingsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const settings = await loadMarketingSettings({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-1">
        <Button
          className="px-0"
          nativeButton={false}
          render={<Link href="/app/marketing" />}
          size="sm"
          variant="link"
        >
          ← Marketing Studio
        </Button>
        <h1 className="text-xl font-semibold">Studio settings</h1>
        <p className="text-sm text-muted-foreground">
          How much the studio does on its own, and the ceilings it works within.
        </p>
      </header>

      <MarketingSettingsForm
        canEdit={canManageWorkspace(context.activeMembership.role)}
        settings={settings}
      />
    </div>
  );
}
