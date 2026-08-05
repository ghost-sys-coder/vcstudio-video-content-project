import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What `/app/marketing/**` renders while the workspace has the studio off.
 *
 * A page rather than `notFound()`: the deployment-disabled case answers 404
 * because an unreleased feature should look like one that was never built, but
 * a workspace that simply has not opted in is a state the user can change, and
 * a dead end would hide that.
 */
export function MarketingDisabledState({
  canManageSettings,
}: {
  canManageSettings: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl border bg-muted"
      >
        <SparklesIcon className="size-6 text-muted-foreground" />
      </span>
      <h1 className="text-2xl font-semibold">The Marketing Studio is off</h1>
      <p className="text-muted-foreground">
        {canManageSettings
          ? "It is switched off for this workspace. Turn it on in workspace settings to start using it."
          : "It is switched off for this workspace. A workspace owner can turn it on from workspace settings."}
      </p>
      <p className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-sm text-notice-info-foreground">
        The Studio drafts content with AI, so it spends from this
        workspace&apos;s budget. That is why it starts switched off rather than
        on.
      </p>
      {canManageSettings ? (
        <Button
          nativeButton={false}
          render={<Link href="/app/settings/workspace" />}
        >
          Open workspace settings
        </Button>
      ) : (
        <Button
          nativeButton={false}
          render={<Link href="/app" />}
          variant="outline"
        >
          Back to projects
        </Button>
      )}
    </div>
  );
}
