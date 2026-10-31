"use client";

import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { PlatformMarkIcon } from "@/components/brand/PlatformMarkIcon";
import { Badge } from "@/components/ui/badge";
import {
  DisconnectChannelDialog,
  type DisconnectChannelResult,
} from "@/components/publish/DisconnectChannelDialog";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PLATFORM_BRAND_BACKGROUND_CLASS } from "@/lib/platforms/platform-brand";
import type { WorkspaceChannelView } from "@/lib/publishing/workspace-connections-view";

const STATUS_LABELS: Record<WorkspaceChannelView["status"], string> = {
  active: "Connected",
  expired: "Needs attention",
  revoked: "Disconnected",
};

export function WorkspaceChannelCard({
  canManageConnections,
  channel,
  onDisconnect,
}: {
  canManageConnections: boolean;
  channel: WorkspaceChannelView;
  onDisconnect: (connectionId: string) => Promise<DisconnectChannelResult>;
}) {
  const active = channel.status === "active";

  return (
    <li className="min-w-0">
      <Card className="h-full gap-4 shadow-sm">
        <CardContent className="flex-1">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-white ${PLATFORM_BRAND_BACKGROUND_CLASS[channel.platform]}`}
            >
              <PlatformMarkIcon
                className="size-5"
                platform={channel.platform}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="w-full truncate text-base font-semibold">
                  {channel.accountName}
                </p>
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
                {channel.platformLabel} channel · Updated{" "}
                {channel.updatedAtLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {channel.postingRequirement}
              </p>
              {channel.lastError ? (
                <p className="mt-1 text-sm text-amber-700 [overflow-wrap:anywhere] dark:text-amber-300">
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
        </CardContent>

        {canManageConnections && channel.status !== "revoked" ? (
          <CardFooter className="mt-auto justify-end bg-transparent">
            <DisconnectChannelDialog
              accountName={channel.accountName}
              connectionId={channel.id}
              onDisconnect={onDisconnect}
              platformLabel={channel.platformLabel}
            />
          </CardFooter>
        ) : null}
      </Card>
    </li>
  );
}
