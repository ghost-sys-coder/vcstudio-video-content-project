"use client";

import { PlatformMarkIcon } from "@/components/brand/PlatformMarkIcon";
import { PLATFORM_BRAND_BACKGROUND_CLASS } from "@/lib/platforms/platform-brand";
import type { PostConnectionView } from "@/lib/social/social-post-view";

/**
 * The accounts a post built here could go to.
 *
 * Shown even though destinations are chosen later in the composer: without it
 * the publish page gives no sign that LinkedIn is connected at all, which is
 * exactly how a connected account goes unnoticed.
 */
export function SocialPostAccountList({
  connections,
}: {
  connections: PostConnectionView[];
}) {
  if (connections.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No post-capable accounts are connected yet.
      </p>
    );

  return (
    <ul className="flex flex-wrap gap-2">
      {connections.map((connection) => (
        <li
          className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3"
          key={connection.id}
        >
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-white ${PLATFORM_BRAND_BACKGROUND_CLASS[connection.platform]}`}
          >
            <PlatformMarkIcon
              className="size-3.5"
              platform={connection.platform}
            />
          </span>
          <span className="text-xs">
            <span className="font-medium">{connection.platformLabel}</span>
            <span className="text-muted-foreground">
              {" · "}
              {connection.accountName}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
