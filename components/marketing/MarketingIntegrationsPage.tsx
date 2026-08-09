import { ConnectedAccountsPanel } from "@/components/social/ConnectedAccountsPanel";
import { MarketingProviderStatusCard } from "@/components/marketing/MarketingProviderStatusCard";
import { GoogleBusinessIntegrationPanel } from "@/components/marketing/GoogleBusinessIntegrationPanel";
import type { MarketingIntegrationsView } from "@/lib/marketing/integrations/marketing-integrations-view";

export function MarketingIntegrationsPage({
  canManageConnections,
  view,
}: {
  canManageConnections: boolean;
  view: MarketingIntegrationsView;
}) {
  return (
    <div className="space-y-8 p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Marketing Studio
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Monitor publishing destinations and the server-side providers that
          power Marketing Studio. Credentials remain server-only.
        </p>
      </header>

      <section aria-labelledby="provider-status-heading" className="space-y-3">
        <div>
          <h2 className="font-semibold" id="provider-status-heading">
            Provider configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Configuration status is derived without exposing credential values.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.providers.map((provider) => (
            <MarketingProviderStatusCard
              key={provider.id}
              provider={provider}
            />
          ))}
        </ul>
      </section>

      <GoogleBusinessIntegrationPanel
        canManage={canManageConnections}
        integration={view.googleBusiness}
      />

      <section aria-label="Connected publishing accounts">
        <ConnectedAccountsPanel
          canManageConnections={canManageConnections}
          connections={view.connections}
        />
      </section>
    </div>
  );
}
