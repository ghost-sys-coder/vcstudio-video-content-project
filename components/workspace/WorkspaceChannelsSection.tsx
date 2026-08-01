"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectWorkspaceChannelAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { ConnectYouTubeButton } from "@/components/publish/ConnectYouTubeButton";
import { ConnectFacebookButton } from "@/components/publish/ConnectFacebookButton";
import { ConnectInstagramButton } from "@/components/publish/ConnectInstagramButton";
import { ConnectLinkedInButton } from "@/components/publish/ConnectLinkedInButton";
import { ConnectTikTokButton } from "@/components/publish/ConnectTikTokButton";
import { ConnectXButton } from "@/components/publish/ConnectXButton";
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

const INSTAGRAM_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The Instagram account is now connected to this workspace.",
  cancelled: "Instagram connection was cancelled.",
  failed: "The Instagram account could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that account.",
  invalid: "The Instagram authorization response was invalid or expired.",
};

const LINKEDIN_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The LinkedIn account is now connected to this workspace.",
  cancelled: "LinkedIn connection was cancelled.",
  failed: "The LinkedIn account could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that account.",
  invalid: "The LinkedIn authorization response was invalid or expired.",
};

const X_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The X account is now connected to this workspace.",
  cancelled: "X connection was cancelled.",
  failed: "The X account could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that account.",
  invalid: "The X authorization response was invalid or expired.",
};

const TIKTOK_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The TikTok account is now connected to this workspace.",
  cancelled: "TikTok connection was cancelled.",
  failed: "The TikTok account could not be connected. Please try again.",
  forbidden: "You do not have permission to connect that account.",
  invalid: "The TikTok authorization response was invalid or expired.",
};

export function WorkspaceChannelsSection({
  initialData,
  oauthStatus,
}: {
  initialData: WorkspaceChannelsView;
  oauthStatus: {
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    tiktok: string | null;
    x: string | null;
    youtube: string | null;
  };
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
    oauthStatus.instagram
      ? INSTAGRAM_OAUTH_MESSAGES[oauthStatus.instagram]
      : null,
    oauthStatus.tiktok ? TIKTOK_OAUTH_MESSAGES[oauthStatus.tiktok] : null,
    oauthStatus.linkedin ? LINKEDIN_OAUTH_MESSAGES[oauthStatus.linkedin] : null,
    oauthStatus.x ? X_OAUTH_MESSAGES[oauthStatus.x] : null,
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
            and social posts to. Credentials remain encrypted and
            workspace-scoped.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialData.enabled ? (
            <>
              <ConnectYouTubeButton
                label={activeCount > 0 ? "Add YouTube" : "Connect YouTube"}
              />
              <ConnectFacebookButton
                label={activeCount > 0 ? "Add Facebook" : "Connect Facebook"}
              />
              <ConnectInstagramButton
                label={activeCount > 0 ? "Add Instagram" : "Connect Instagram"}
              />
              <ConnectTikTokButton
                label={activeCount > 0 ? "Add TikTok" : "Connect TikTok"}
              />
            </>
          ) : null}
          {/*
            LinkedIn and X are social-post destinations only — neither has a
            rendered-video path — so they follow the posting flag rather than the
            video one.
          */}
          {initialData.socialPostingEnabled ? (
            <>
              <ConnectLinkedInButton
                label={activeCount > 0 ? "Add LinkedIn" : "Connect LinkedIn"}
              />
              <ConnectXButton label={activeCount > 0 ? "Add X" : "Connect X"} />
            </>
          ) : null}
        </div>
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
              Connect YouTube, a Facebook Page, Instagram, or TikTok to deliver
              completed videos from VCStudio.
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
