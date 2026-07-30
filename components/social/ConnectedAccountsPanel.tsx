import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPlatformPostCapability,
  isSocialPostPlatform,
} from "@/lib/social/platform-post-capabilities";
import type { PostConnectionView } from "@/lib/social/social-post-view";

/**
 * Read-only view of the accounts this workspace can post to, with each
 * platform's rules stated next to it.
 *
 * Connecting and disconnecting stay in workspace settings — this is a
 * workspace-level home for the same information, since the composer's
 * destination list is otherwise the only place a post author sees it.
 */
export function ConnectedAccountsPanel({
  connections,
}: {
  connections: PostConnectionView[];
}) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Where this workspace can post, and what each destination accepts.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/app/settings/workspace" />}
          size="sm"
          variant="outline"
        >
          Manage connections
        </Button>
      </header>

      {connections.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No accounts are connected yet. Connect one in workspace settings, then
          it becomes selectable in the composer.
        </p>
      ) : (
        <ul className="space-y-2">
          {connections.map((connection) => (
            <li
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3"
              key={connection.id}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {connection.platformLabel}
                  </span>
                  <Badge
                    variant={
                      connection.status === "active"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {connection.status}
                  </Badge>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {connection.accountName}
                </p>
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                {isSocialPostPlatform(connection.platform)
                  ? getPlatformPostCapability(connection.platform)
                      .mediaRequirement
                  : "This account is used for video publishing only."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
