"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignProjectChannelAction } from "@/app/(authenticated)/app/settings/workspace/channel-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface ProjectChannelOption {
  id: string;
  name: string;
  platform: string;
  canPublish: boolean;
}

/**
 * Assigns one project to a production channel, or back to unassigned.
 *
 * "No channel" is a first-class option rather than an omission: projects that
 * predate channels must stay usable, and a creator must be able to detach one
 * without deleting anything.
 */
export function ProjectChannelSection({
  canEdit,
  channels,
  projectId,
  selectedChannelId,
}: {
  canEdit: boolean;
  channels: ProjectChannelOption[];
  projectId: string;
  selectedChannelId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(selectedChannelId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("channelProfileId", value);
      const result = await assignProjectChannelAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const selected = channels.find((channel) => channel.id === value) ?? null;
  const dirty = (selectedChannelId ?? "") !== value;

  return (
    <section
      aria-labelledby="project-channel-heading"
      className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
    >
      <h2 className="text-lg font-semibold" id="project-channel-heading">
        Production channel
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Groups this project with the channel it is produced for, and decides
        which connected account a finished video is published to.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 max-w-sm flex-1 space-y-1.5">
          <Label className="text-xs" htmlFor="project-channel-select">
            Channel
          </Label>
          <select
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
            disabled={!canEdit || isPending}
            id="project-channel-select"
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            value={value}
          >
            <option value="">No channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} · {channel.platform}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <Button
            className="h-10 shrink-0"
            disabled={!dirty || isPending}
            onClick={save}
            type="button"
          >
            {isPending ? "Saving…" : "Save channel"}
          </Button>
        ) : null}
      </div>

      {channels.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No production channels have been defined yet. This project works
          without one; add channels in workspace settings to group projects.
        </p>
      ) : null}
      {selected && !selected.canPublish ? (
        <p className="mt-3 text-xs text-amber-600">
          This channel&apos;s account is not currently connected. The project
          and its history are unaffected, but publishing to it is blocked until
          the account is reconnected.
        </p>
      ) : null}
      {saved && !dirty ? (
        <p className="mt-3 text-xs text-emerald-600" role="status">
          Channel saved.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
