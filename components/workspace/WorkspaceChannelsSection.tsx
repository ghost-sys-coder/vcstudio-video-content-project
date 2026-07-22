"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectWorkspaceChannelAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { ConnectYouTubeButton } from "@/components/publish/ConnectYouTubeButton";
import { ConnectFacebookButton } from "@/components/publish/ConnectFacebookButton";
import { FutureChannelPlatformCard } from "@/components/workspace/FutureChannelPlatformCard";
import { WorkspaceChannelCard } from "@/components/workspace/WorkspaceChannelCard";
import type { WorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";

const YOUTUBE_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The YouTube channel is now connected to this workspace.",
  cancelled: "YouTube connection was cancelled.",
  failed: "The YouTube channel could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that channel.",
  invalid: "The YouTube authorization response was invalid or expired.",
};

const FACEBOOK_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The Facebook Page is now connected to this workspace.",
  cancelled: "Facebook connection was cancelled.",
  expired: "The Facebook Page selection expired. Connect again.",
  failed: "The Facebook Page could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that Page.",
  invalid: "The Facebook authorization response was invalid or expired.",
};

export function WorkspaceChannelsSection({
  initialData,
  oauthStatus,
}: {
  initialData: WorkspaceChannelsView;
  oauthStatus: { facebook: string | null; youtube: string | null };
}) {
  const router = useRouter();
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = initialData.channels.filter(
    (channel) => channel.status === "active",
  ).length;
  const futurePlatforms = initialData.platforms.filter(
    (platform) => !platform.available,
  );

  function disconnect(connectionId: string) {
    setError(null);
    setPendingConnectionId(connectionId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("connectionId", connectionId);
      const result = await disconnectWorkspaceChannelAction(formData);
      if (!result.success) setError(result.error);
      setPendingConnectionId(null);
      if (result.success) router.refresh();
    });
  }

  const oauthMessages = [
    oauthStatus.youtube ? YOUTUBE_OAUTH_MESSAGES[oauthStatus.youtube] : null,
    oauthStatus.facebook ? FACEBOOK_OAUTH_MESSAGES[oauthStatus.facebook] : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <section
      aria-labelledby="workspace-channels-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Publishing
          </p>
          <h2
            className="mt-2 text-xl font-semibold tracking-tight"
            id="workspace-channels-heading"
          >
            Connected channels
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage the destinations this workspace can publish finished videos
            to. Credentials remain encrypted and workspace-scoped.
          </p>
        </div>
        {initialData.enabled ? (
          <div className="flex flex-wrap gap-2">
            <ConnectYouTubeButton
              label={activeCount > 0 ? "Add YouTube" : "Connect YouTube"}
            />
            <ConnectFacebookButton
              label={activeCount > 0 ? "Add Facebook" : "Connect Facebook"}
            />
          </div>
        ) : null}
      </div>

      {oauthMessages.map((message) => (
        <p
          className="mt-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
          key={message}
          role="status"
        >
          {message}
        </p>
      ))}
      {error ? (
        <p
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {!initialData.enabled ? (
        <p className="mt-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Video publishing is currently disabled for this deployment.
        </p>
      ) : null}

      <div className="mt-6">
        {initialData.channels.length > 0 ? (
          <ul className="space-y-3">
            {initialData.channels.map((channel) => (
              <WorkspaceChannelCard
                busy={isPending && pendingConnectionId === channel.id}
                channel={channel}
                key={channel.id}
                onDisconnect={disconnect}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No channels connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect YouTube or a Facebook Page to publish completed videos
              from VCStudio.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-sm font-semibold">More platforms</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {futurePlatforms.map((platform) => (
            <FutureChannelPlatformCard
              key={platform.platform}
              label={platform.label}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
