"use client";

import { LoaderCircle, Music2, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelPublicationAction,
  disconnectPlatformAction,
  loadPublishingViewAction,
  publishVideoAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ConnectYouTubeButton } from "@/components/publish/ConnectYouTubeButton";
import { ConnectFacebookButton } from "@/components/publish/ConnectFacebookButton";
import { ConnectInstagramButton } from "@/components/publish/ConnectInstagramButton";
import { ConnectTikTokButton } from "@/components/publish/ConnectTikTokButton";
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
  return (
    status === "pending" ||
    status === "queued" ||
    status === "uploading" ||
    status === "processing"
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1_048_576))} MB`;
}

export function PublishToPlatformPanel({
  projectId,
  canManageConnections,
  canPublish,
  initialData,
}: {
  projectId: string;
  canManageConnections: boolean;
  canPublish: boolean;
  initialData: PublishingView;
}) {
  const [data, setData] = useState<PublishingView>(initialData);
  const [renderId, setRenderId] = useState<string>(
    initialData.renders[0]?.id ?? "",
  );
  const [connectionId, setConnectionId] = useState<string>(
    initialData.connections.find((entry) => entry.status === "active")?.id ??
      "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<string>("private");
  const [caption, setCaption] = useState("");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [tiktokConsent, setTikTokConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  const activeConnections = useMemo(
    () => data.connections.filter((entry) => entry.status === "active"),
    [data.connections],
  );
  const activeConnection = useMemo(
    () =>
      activeConnections.find((entry) => entry.id === connectionId) ??
      activeConnections[0] ??
      null,
    [activeConnections, connectionId],
  );
  const connectionItems = useMemo(
    () =>
      Object.fromEntries(
        activeConnections.map((entry) => [
          entry.id,
          `${entry.accountName} · ${entry.platformLabel}`,
        ]),
      ),
    [activeConnections],
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
  const facebookSelected = activeConnection?.platform === "facebook";
  const instagramSelected = activeConnection?.platform === "instagram";
  const tiktokSelected = activeConnection?.platform === "tiktok";
  const effectiveVisibility = tiktokSelected
    ? "platform_default"
    : instagramSelected
      ? "public"
      : facebookSelected && visibility === "unlisted"
        ? "private"
        : visibility;
  const selectedVisibilityItems = facebookSelected
    ? { private: "Draft — not published", public: "Public — publish to Page" }
    : visibilityItems;

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
      if (instagramSelected) {
        formData.set("caption", caption);
        formData.set("shareToFeed", String(shareToFeed));
      } else if (tiktokSelected) {
        formData.set("consentConfirmed", String(tiktokConsent));
      } else {
        formData.set("title", title.trim());
        formData.set("description", description);
        formData.set("tags", tags);
      }
      formData.set("visibility", effectiveVisibility);
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

  const titleMissing =
    !instagramSelected && !tiktokSelected && title.trim() === "";
  const canSubmit =
    canPublish &&
    !busy &&
    data.enabled &&
    activeConnection !== null &&
    selectedRender !== null &&
    !selectedRender.tooLarge &&
    (!instagramSelected || selectedRender.instagramEligible) &&
    (!tiktokSelected || selectedRender.tiktokEligible) &&
    (!tiktokSelected || tiktokConsent) &&
    !titleMissing;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Publish to a platform</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Publish to YouTube, Facebook, or Instagram, or deliver a video to a
          creator&apos;s TikTok inbox.
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
                canManage={canManageConnections}
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
        {canManageConnections && data.enabled ? (
          <div className="mt-1 flex flex-wrap gap-2">
            <ConnectYouTubeButton
              label={
                activeConnections.length > 0 ? "Add YouTube" : "Connect YouTube"
              }
            />
            <ConnectFacebookButton
              label={
                activeConnections.length > 0
                  ? "Add Facebook"
                  : "Connect Facebook"
              }
            />
            <ConnectInstagramButton
              label={
                activeConnections.length > 0
                  ? "Add Instagram"
                  : "Connect Instagram"
              }
            />
            <ConnectTikTokButton
              label={
                activeConnections.length > 0 ? "Add TikTok" : "Connect TikTok"
              }
            />
          </div>
        ) : null}
      </div>

      {activeConnection && data.enabled ? (
        data.renders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No finished renders yet. Render the video first, then publish it.
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="publish-channel">
                  Channel
                </Label>
                <Select
                  items={connectionItems}
                  onValueChange={(value) => setConnectionId(String(value))}
                  value={activeConnection?.id ?? ""}
                >
                  <SelectTrigger id="publish-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                      <SelectItem
                        disabled={
                          (instagramSelected && !render.instagramEligible) ||
                          (tiktokSelected && !render.tiktokEligible)
                        }
                        key={render.id}
                        value={render.id}
                      >
                        {render.label}
                        {instagramSelected && !render.instagramEligible
                          ? " · Not Reel-compatible"
                          : tiktokSelected && !render.tiktokEligible
                            ? " · Not TikTok-compatible"
                            : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!instagramSelected && !tiktokSelected ? (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="publish-visibility">
                    Visibility
                  </Label>
                  <Select
                    items={selectedVisibilityItems}
                    onValueChange={(value) => setVisibility(String(value))}
                    value={effectiveVisibility}
                  >
                    <SelectTrigger id="publish-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">
                        {facebookSelected
                          ? "Draft — not published"
                          : "Private — only you"}
                      </SelectItem>
                      {!facebookSelected ? (
                        <SelectItem value="unlisted">
                          Unlisted — anyone with the link
                        </SelectItem>
                      ) : null}
                      <SelectItem value="public">
                        {facebookSelected
                          ? "Public — publish to Page"
                          : "Public — listed and searchable"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : instagramSelected ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Instagram Reels publish publicly.
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  TikTok visibility and metadata are selected in TikTok.
                </div>
              )}
            </div>

            {instagramSelected ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs" htmlFor="publish-caption">
                      Caption
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {caption.length}/2200
                    </span>
                  </div>
                  <Textarea
                    id="publish-caption"
                    maxLength={2200}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Write a caption and include hashtags if needed"
                    rows={6}
                    value={caption}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input
                    checked={shareToFeed}
                    className="mt-0.5 size-4 accent-primary"
                    onChange={(event) => setShareToFeed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      Share to feed
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Show this Reel in the account&apos;s main profile feed
                      too.
                    </span>
                  </span>
                </label>
              </div>
            ) : tiktokSelected ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Deliver to TikTok inbox</p>
                <p className="text-xs text-muted-foreground">
                  TikTok will notify the connected creator. The creator must
                  open TikTok to edit the post, choose visibility and
                  interactions, and complete publishing.
                </p>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    checked={tiktokConsent}
                    className="mt-0.5 size-4 accent-primary"
                    onChange={(event) => setTikTokConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-sm">
                    I confirm that I reviewed this video and expressly consent
                    to sending it to the connected TikTok account.
                  </span>
                </label>
              </div>
            ) : (
              <>
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
              </>
            )}

            {selectedRender?.tooLarge ? (
              <p className="text-xs text-destructive">
                That render is {formatBytes(selectedRender.sizeBytes)}, above
                the {formatBytes(data.maxVideoBytes)} publishing limit.
              </p>
            ) : null}
            {instagramSelected &&
            selectedRender &&
            !selectedRender.instagramEligible ? (
              <p className="text-xs text-destructive">
                {selectedRender.instagramIneligibilityReason}
              </p>
            ) : null}
            {tiktokSelected &&
            selectedRender &&
            !selectedRender.tiktokEligible ? (
              <p className="text-xs text-destructive">
                {selectedRender.tiktokIneligibilityReason}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                className={
                  tiktokSelected
                    ? "h-11 gap-2.5 border-black/80 bg-black px-5 text-white shadow-[3px_3px_0_#25f4ee,-3px_-3px_0_#fe2c55] hover:bg-zinc-900 hover:shadow-[4px_4px_0_#25f4ee,-4px_-4px_0_#fe2c55] focus-visible:ring-[#25f4ee] disabled:shadow-none"
                    : "h-10 px-4"
                }
                disabled={!canSubmit}
                onClick={publish}
                type="button"
              >
                {uploading || busy ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : tiktokSelected ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/10">
                    <Music2 aria-hidden className="size-4" />
                  </span>
                ) : (
                  <Send aria-hidden />
                )}
                <span>
                  {uploading
                    ? tiktokSelected
                      ? "Uploading to TikTok…"
                      : "Uploading…"
                    : busy
                      ? "Preparing upload…"
                      : tiktokSelected
                        ? "Send to TikTok inbox"
                        : `Publish to ${activeConnection.platformLabel}`}
                </span>
              </Button>
              {selectedRender ? (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(selectedRender.sizeBytes)} ·{" "}
                  {selectedRender.durationSeconds}s
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {instagramSelected
                ? "Instagram will process this vertical Reel before publishing it."
                : tiktokSelected
                  ? "Delivery is not publication. Complete the post from TikTok's inbox notification."
                  : `Uploads use ${effectiveVisibility} visibility.`}{" "}
              Publishing does not cost credits; each platform may enforce its
              own upload limits.
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
