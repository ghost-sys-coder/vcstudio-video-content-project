"use client";

import { useRouter } from "next/navigation";
import { disconnectWorkspaceChannelAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { ConnectYouTubeButton } from "@/components/publish/ConnectYouTubeButton";
import { ConnectFacebookButton } from "@/components/publish/ConnectFacebookButton";
import { ConnectInstagramButton } from "@/components/publish/ConnectInstagramButton";
import { ConnectLinkedInButton } from "@/components/publish/ConnectLinkedInButton";
import { ConnectLinkedInPageButton } from "@/components/publish/ConnectLinkedInPageButton";
import { ConnectTikTokButton } from "@/components/publish/ConnectTikTokButton";
import { ConnectXButton } from "@/components/publish/ConnectXButton";
import { FutureChannelPlatformCard } from "@/components/workspace/FutureChannelPlatformCard";
import { WorkspaceChannelCard } from "@/components/workspace/WorkspaceChannelCard";
import type { WorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";
import type { ConnectionOAuthStatus } from "@/lib/schemas/connection-oauth";

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

const LINKEDIN_PAGES_OAUTH_MESSAGES: Record<string, string> = {
  connected: "The LinkedIn Page is now connected to this workspace.",
  cancelled: "LinkedIn Page connection was cancelled.",
  expired: "LinkedIn Page selection expired. Connect again.",
  forbidden: "You do not have permission to connect that LinkedIn Page.",
  invalid: "The LinkedIn Page authorization was invalid or expired.",
  failed:
    "The LinkedIn Page could not be connected. Check the Pages app's Community Management access and your Page role, then try again.",
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
  failed:
    "The TikTok account could not be connected. Check the sandbox credentials, target user, enabled scopes and exact callback, then connect again.",
  forbidden: "You do not have permission to connect that account.",
  invalid: "The TikTok authorization response was invalid or expired.",
};

export function WorkspaceChannelsSection({
  canManageConnections,
  initialData,
  oauthStatus,
}: {
  canManageConnections: boolean;
  initialData: WorkspaceChannelsView;
  oauthStatus: ConnectionOAuthStatus;
}) {
  const router = useRouter();
  const activeCount = initialData.channels.filter(
    (channel) => channel.status === "active",
  ).length;
  const futurePlatforms = initialData.platforms.filter(
    (platform) => !platform.available,
  );

  async function disconnect(connectionId: string) {
    const formData = new FormData();
    formData.set("connectionId", connectionId);
    const result = await disconnectWorkspaceChannelAction(formData);
    if (result.success) router.refresh();
    return result;
  }

  const oauthMessages = [
    oauthStatus.youtube ? YOUTUBE_OAUTH_MESSAGES[oauthStatus.youtube] : null,
    oauthStatus.facebook ? FACEBOOK_OAUTH_MESSAGES[oauthStatus.facebook] : null,
    oauthStatus.instagram
      ? INSTAGRAM_OAUTH_MESSAGES[oauthStatus.instagram]
      : null,
    oauthStatus.tiktok ? TIKTOK_OAUTH_MESSAGES[oauthStatus.tiktok] : null,
    oauthStatus.linkedin ? LINKEDIN_OAUTH_MESSAGES[oauthStatus.linkedin] : null,
    oauthStatus.linkedinPages
      ? LINKEDIN_PAGES_OAUTH_MESSAGES[oauthStatus.linkedinPages]
      : null,
    oauthStatus.x ? X_OAUTH_MESSAGES[oauthStatus.x] : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <section aria-labelledby="workspace-channels-heading" className="app-page">
      <div className="app-page-header">
        <div className="app-heading">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Publishing
          </p>
          <h1
            className="text-xl font-semibold tracking-tight"
            id="workspace-channels-heading"
          >
            Accounts &amp; connections
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage the destinations this workspace can publish finished videos
            and social posts to. Credentials remain encrypted and
            workspace-scoped.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageConnections && initialData.enabled ? (
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
          {canManageConnections && initialData.socialPostingEnabled ? (
            <>
              <ConnectLinkedInButton label="Connect LinkedIn profile" />
              <ConnectLinkedInPageButton />
              <ConnectXButton label={activeCount > 0 ? "Add X" : "Connect X"} />
            </>
          ) : null}
        </div>
      </div>

      {!canManageConnections ? (
        <p className="text-sm text-muted-foreground">
          Only workspace owners can connect or disconnect accounts. You can
          review account status and posting requirements here.
        </p>
      ) : null}

      {oauthMessages.map((message) => (
        <p
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
          key={message}
          role="status"
        >
          {message}
        </p>
      ))}
      {!initialData.enabled ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Video publishing is currently disabled for this deployment.
        </p>
      ) : null}

      <div>
        {initialData.channels.length > 0 ? (
          <ul className="app-grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
            {initialData.channels.map((channel) => (
              <WorkspaceChannelCard
                canManageConnections={canManageConnections}
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
              {canManageConnections
                ? "Connect a publishing account to make it available for videos or social posts."
                : "Ask a workspace owner to connect a publishing account."}
            </p>
          </div>
        )}
      </div>

      {futurePlatforms.length > 0 ? (
        <div className="border-t pt-6">
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
      ) : null}
    </section>
  );
}
