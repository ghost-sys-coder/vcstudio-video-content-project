"use client";

import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { YouTubeMarkIcon } from "@/components/brand/YouTubeMarkIcon";
import { FacebookMarkIcon } from "@/components/brand/FacebookMarkIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceChannelView } from "@/lib/publishing/workspace-connections-view";

const STATUS_LABELS: Record<WorkspaceChannelView["status"], string> = {
  active: "Connected",
  expired: "Needs attention",
  revoked: "Disconnected",
};

export function WorkspaceChannelCard({
  busy,
  channel,
  onDisconnect,
}: {
  busy: boolean;
  channel: WorkspaceChannelView;
  onDisconnect: (connectionId: string) => void;
}) {
  const active = channel.status === "active";

  return (
    <li className="rounded-xl border bg-background p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-white ${channel.platform === "facebook" ? "bg-[#1877f2]" : "bg-[#e60000]"}`}
          >
            {channel.platform === "facebook" ? (
              <FacebookMarkIcon className="size-5" />
            ) : (
              <YouTubeMarkIcon className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{channel.accountName}</p>
              <Badge
                className={
                  active
                    ? "border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : "px-2.5 py-1"
                }
                variant={active ? "outline" : "secondary"}
              >
                {active ? (
                  <CheckCircle2Icon aria-hidden className="size-3" />
                ) : (
                  <TriangleAlertIcon aria-hidden className="size-3" />
                )}
                {STATUS_LABELS[channel.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {channel.platformLabel} channel · Updated {channel.updatedAtLabel}
            </p>
            {channel.lastError ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {channel.lastError}
              </p>
            ) : null}
            {channel.accountUrl ? (
              <a
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                href={channel.accountUrl}
                rel="noreferrer"
                target="_blank"
              >
                View channel
                <ExternalLinkIcon aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        {channel.status !== "revoked" ? (
          <Button
            disabled={busy}
            onClick={() => onDisconnect(channel.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
