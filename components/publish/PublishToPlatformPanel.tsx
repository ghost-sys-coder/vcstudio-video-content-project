"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelPublicationAction,
  disconnectPlatformAction,
  loadPublishingViewAction,
  publishVideoAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ConnectYouTubeButton } from "@/components/publish/ConnectYouTubeButton";
import { PlatformConnectionRow } from "@/components/publish/PlatformConnectionRow";
import { VideoPublicationRow } from "@/components/publish/VideoPublicationRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PublishingView } from "@/lib/publishing/publishing-view";

const visibilityItems = {
  private: "Private — only you",
  unlisted: "Unlisted — anyone with the link",
  public: "Public — listed and searchable",
};

function isActiveStatus(status: string): boolean {
  return status === "pending" || status === "queued" || status === "uploading";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1_048_576))} MB`;
}

export function PublishToPlatformPanel({
  projectId,
  canPublish,
  initialData,
}: {
  projectId: string;
  canPublish: boolean;
  initialData: PublishingView;
}) {
  const [data, setData] = useState<PublishingView>(initialData);
  const [renderId, setRenderId] = useState<string>(
    initialData.renders[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<string>("private");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  const activeConnection = useMemo(
    () => data.connections.find((entry) => entry.status === "active") ?? null,
    [data.connections],
  );
  const renderItems = useMemo(
    () =>
      Object.fromEntries(data.renders.map((entry) => [entry.id, entry.label])),
    [data.renders],
  );
  const selectedRender = useMemo(
    () => data.renders.find((entry) => entry.id === renderId) ?? null,
    [data.renders, renderId],
  );
  const uploading = useMemo(
    () => data.publications.some((entry) => isActiveStatus(entry.status)),
    [data.publications],
  );

  const refresh = useCallback(async () => {
    const view = await loadPublishingViewAction(projectId);
    if (view) setData(view);
    return view;
  }, [projectId]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let attempt = 0; attempt < 120; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const view = await refresh();
        if (
          view &&
          !view.publications.some((entry) => isActiveStatus(entry.status))
        )
          return;
      }
    } finally {
      pollingRef.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    if (uploading) void poll();
  }, [uploading, poll]);

  async function publish() {
    if (!activeConnection || !selectedRender) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("renderId", selectedRender.id);
      formData.set("connectionId", activeConnection.id);
      formData.set("platform", activeConnection.platform);
      formData.set("title", title.trim());
      formData.set("description", description);
      formData.set("tags", tags);
      formData.set("visibility", visibility);
      formData.set("requestNonce", crypto.randomUUID());
      const result = await publishVideoAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(publicationId: string) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("publicationId", publicationId);
      const result = await cancelPublicationAction(formData);
      if (!result.success) setError(result.error);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(connectionId: string) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("connectionId", connectionId);
      const result = await disconnectPlatformAction(formData);
      if (!result.success) setError(result.error);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const titleMissing = title.trim() === "";
  const canSubmit =
    canPublish &&
    !busy &&
    data.enabled &&
    activeConnection !== null &&
    selectedRender !== null &&
    !selectedRender.tooLarge &&
    !titleMissing;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Publish to a platform</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a finished render straight to a connected account. YouTube is
          available now; Facebook, Instagram, and TikTok use the same connection
          and history once their integrations land.
        </p>
      </div>

      {!data.enabled ? (
        <p className="text-xs text-muted-foreground">
          Publishing is currently disabled.
        </p>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Connected accounts
        </h3>
        {data.connections.length > 0 ? (
          <ul className="space-y-2">
            {data.connections.map((connection) => (
              <PlatformConnectionRow
                busy={busy}
                canManage={canPublish}
                connection={connection}
                key={connection.id}
                onDisconnect={disconnect}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No accounts connected yet.
          </p>
        )}
        {canPublish && data.enabled && !activeConnection ? (
          <ConnectYouTubeButton className="mt-1" />
        ) : null}
      </div>

      {activeConnection && data.enabled ? (
        data.renders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No finished renders yet. Render the video first, then publish it.
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="publish-render">
                  Render
                </Label>
                <Select
                  items={renderItems}
                  onValueChange={(value) => {
                    setError(null);
                    setRenderId(String(value));
                  }}
                  value={renderId}
                >
                  <SelectTrigger id="publish-render">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.renders.map((render) => (
                      <SelectItem key={render.id} value={render.id}>
                        {render.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="publish-visibility">
                  Visibility
                </Label>
                <Select
                  items={visibilityItems}
                  onValueChange={(value) => setVisibility(String(value))}
                  value={visibility}
                >
                  <SelectTrigger id="publish-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private — only you</SelectItem>
                    <SelectItem value="unlisted">
                      Unlisted — anyone with the link
                    </SelectItem>
                    <SelectItem value="public">
                      Public — listed and searchable
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="publish-title">
                Title
              </Label>
              <Input
                id="publish-title"
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Video title"
                value={title}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="publish-description">
                Description
              </Label>
              <Textarea
                id="publish-description"
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description shown under the video"
                rows={3}
                value={description}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="publish-tags">
                Tags
              </Label>
              <Input
                id="publish-tags"
                onChange={(event) => setTags(event.target.value)}
                placeholder="Comma separated, e.g. focus, productivity"
                value={tags}
              />
            </div>

            {selectedRender?.tooLarge ? (
              <p className="text-xs text-destructive">
                That render is {formatBytes(selectedRender.sizeBytes)}, above
                the {formatBytes(data.maxVideoBytes)} publishing limit.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!canSubmit} onClick={publish} type="button">
                {uploading
                  ? "Uploading…"
                  : busy
                    ? "Starting…"
                    : `Publish to ${activeConnection.platformLabel}`}
              </Button>
              {selectedRender ? (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(selectedRender.sizeBytes)} ·{" "}
                  {selectedRender.durationSeconds}s
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Uploads go to the channel as {visibility}. Publishing does not
              cost credits, but YouTube limits how many videos an account can
              upload per day.
            </p>
          </div>
        )
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {data.publications.length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-medium text-muted-foreground">
            Publish history
          </h3>
          <ul className="space-y-2">
            {data.publications.map((publication) => (
              <VideoPublicationRow
                busy={busy}
                canManage={canPublish}
                key={publication.id}
                onCancel={cancel}
                publication={publication}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
