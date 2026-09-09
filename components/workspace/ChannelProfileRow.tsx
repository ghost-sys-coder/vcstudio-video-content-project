"use client";

import { AlertTriangleIcon, CheckIcon, ArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChannelProfileView } from "@/lib/channels/channel-profile-view";

export function ChannelProfileRow({
  channel,
  canManage,
  onArchive,
}: {
  channel: ChannelProfileView;
  canManage: boolean;
  onArchive: (channelProfileId: string, name: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="truncate">{channel.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {channel.platform}
          </span>
          {channel.canPublish ? (
            <span className="flex items-center gap-1 text-xs font-normal text-emerald-600">
              <CheckIcon aria-hidden className="size-3.5" /> ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-normal text-amber-600">
              <AlertTriangleIcon aria-hidden className="size-3.5" />
              {channel.availability.replace("_", " ")}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {channel.availabilityMessage}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {channel.language} · {channel.cadence} · {channel.timeZone} ·{" "}
          {channel.projectCount}{" "}
          {channel.projectCount === 1 ? "project" : "projects"}
          {channel.connectedAccountName
            ? ` · ${channel.connectedAccountName}`
            : null}
        </p>
      </div>
      {canManage ? (
        <Button
          className="shrink-0"
          onClick={() => onArchive(channel.id, channel.name)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArchiveIcon aria-hidden /> Archive
        </Button>
      ) : null}
    </li>
  );
}
