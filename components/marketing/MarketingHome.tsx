import Link from "next/link";
import { SettingsIcon } from "lucide-react";
import { MarketingSetupStep } from "@/components/marketing/MarketingSetupStep";
import { Button } from "@/components/ui/button";
import type { MarketingSetupStep as SetupStep } from "@/lib/marketing/marketing-setup-steps";

/**
 * The studio's landing screen.
 *
 * While the studio is being built out this is deliberately a setup checklist
 * rather than a dashboard of zeroes. There is nothing to report yet, and a wall
 * of "0 posts, $0.00 spent" would imply the feature ran and did nothing.
 */
export function MarketingHome({
  autonomyLabel,
  steps,
}: {
  autonomyLabel: string;
  steps: SetupStep[];
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Marketing Studio</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            An AI marketing team for this workspace. It learns the business,
            drafts content for each platform, and — as you let it — puts that
            content on a schedule.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/app/marketing/settings" />}
          variant="outline"
        >
          <SettingsIcon />
          Settings
        </Button>
      </header>

      <section className="rounded-xl border bg-muted/30 p-4">
        <h2 className="text-sm font-medium">Currently</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Autonomy is set to <strong>{autonomyLabel}</strong>. Nothing is
          generated, approved, or published without you until you raise it.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Getting set up</h2>
          <p className="text-xs text-muted-foreground">
            The studio is being delivered in stages. Steps marked{" "}
            <em>not built yet</em> are planned, not missing.
          </p>
        </div>
        <ul className="space-y-2">
          {steps.map((step) => (
            <MarketingSetupStep
              description={step.description}
              href={step.href}
              key={step.key}
              label={step.label}
              state={step.state}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
