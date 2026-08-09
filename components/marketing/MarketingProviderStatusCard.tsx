import {
  CheckCircle2Icon,
  CircleOffIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MarketingProviderStatus } from "@/lib/marketing/integrations/marketing-integrations-view";

const LABELS: Record<MarketingProviderStatus["state"], string> = {
  ready: "Ready",
  setup_required: "Setup required",
  disabled: "Disabled",
};

export function MarketingProviderStatusCard({
  provider,
}: {
  provider: MarketingProviderStatus;
}) {
  const Icon =
    provider.state === "ready"
      ? CheckCircle2Icon
      : provider.state === "disabled"
        ? CircleOffIcon
        : TriangleAlertIcon;

  return (
    <li className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{provider.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {provider.description}
          </p>
        </div>
        <Badge variant={provider.state === "ready" ? "secondary" : "outline"}>
          <Icon aria-hidden />
          {LABELS[provider.state]}
        </Badge>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{provider.detail}</p>
    </li>
  );
}
