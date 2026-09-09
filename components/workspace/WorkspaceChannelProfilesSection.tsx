"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RadioTowerIcon } from "lucide-react";
import { archiveChannelProfileAction } from "@/app/(authenticated)/app/settings/workspace/channel-actions";
import { ChannelProfileForm } from "@/components/workspace/ChannelProfileForm";
import { ChannelProfileRow } from "@/components/workspace/ChannelProfileRow";
import { Button } from "@/components/ui/button";
import type { ChannelProfileView } from "@/lib/channels/channel-profile-view";

/**
 * Production channels, deliberately separate from the "Connected channels"
 * section above it. That one manages OAuth grants; this one manages the
 * editorial identities a workspace produces for, which outlive any grant.
 */
export function WorkspaceChannelProfilesSection({
  canManage,
  channels,
  unassignedProjectCount,
}: {
  canManage: boolean;
  channels: ChannelProfileView[];
  unassignedProjectCount: number;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive(channelProfileId: string, name: string) {
    if (
      !window.confirm(
        `Archive "${name}"? Its projects and published history are kept, and it stops appearing when assigning new projects.`,
      )
    )
      return;
    const formData = new FormData();
    formData.set("channelProfileId", channelProfileId);
    const result = await archiveChannelProfileAction(formData);
    if (!result.success) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <section
      aria-labelledby="workspace-channel-profiles-heading"
      className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            id="workspace-channel-profiles-heading"
          >
            Production channels
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The channels this workspace produces for. A production channel keeps
            its identity, defaults and project history even when its account is
            disconnected or reconnected.
          </p>
        </div>
        {canManage ? (
          <Button
            className="shrink-0"
            onClick={() => setFormOpen(true)}
            size="sm"
            type="button"
          >
            <RadioTowerIcon aria-hidden /> Add channel
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {canManage ? null : (
          <p className="text-sm text-muted-foreground">
            Only workspace owners can add or archive production channels.
          </p>
        )}
        {channels.length ? (
          <ul className="divide-y rounded-lg border">
            {channels.map((channel) => (
              <ChannelProfileRow
                canManage={canManage}
                channel={channel}
                key={channel.id}
                onArchive={archive}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No production channels yet. Projects stay fully usable without one.
          </p>
        )}
        {unassignedProjectCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {unassignedProjectCount}{" "}
            {unassignedProjectCount === 1 ? "project is" : "projects are"} not
            assigned to a channel. They keep working exactly as they are; assign
            them from each project&apos;s settings when you want them grouped.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ChannelProfileForm
        onCreated={() => router.refresh()}
        onOpenChange={setFormOpen}
        open={formOpen}
      />
    </section>
  );
}
