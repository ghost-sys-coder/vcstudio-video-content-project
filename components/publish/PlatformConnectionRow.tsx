"use client";

import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectionView } from "@/lib/publishing/publishing-view";

export function PlatformConnectionRow({
  connection,
  canManage,
  busy,
  onDisconnect,
}: {
  connection: ConnectionView;
  canManage: boolean;
  busy: boolean;
  onDisconnect: (connectionId: string) => void;
}) {
  const isActive = connection.status === "active";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {isActive ? (
          <CheckCircle2Icon
            aria-hidden
            className="size-4 shrink-0 text-emerald-600"
          />
        ) : (
          <TriangleAlertIcon
            aria-hidden
            className="size-4 shrink-0 text-amber-600"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {connection.accountName}
          </p>
          <p className="text-xs text-muted-foreground">
            {connection.platformLabel}
            {isActive
              ? ""
              : connection.status === "expired"
                ? " · authorization expired"
                : " · disconnected"}
          </p>
          {connection.lastError ? (
            <p className="mt-0.5 text-xs text-amber-700">
              {connection.lastError}
            </p>
          ) : null}
        </div>
      </div>

      {canManage && connection.status !== "revoked" ? (
        <Button
          disabled={busy}
          onClick={() => onDisconnect(connection.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          Disconnect
        </Button>
      ) : null}
    </li>
  );
}
