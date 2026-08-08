import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { PostStatusBadge } from "@/components/social/PostStatusBadge";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/format/date";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export function SocialPostRow({
  composerBasePath = "/app/social/posts",
  post,
}: {
  composerBasePath?: string;
  post: SocialPostSummaryView;
}) {
  return (
    <li>
      <Link
        className="flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`${composerBasePath}/${post.id}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {post.name.trim() === "" ? "Untitled post" : post.name}
          </span>
          <PostStatusBadge status={post.status} />
          {post.mediaCount > 0 ? (
            <Badge variant="outline">
              <ImageIcon aria-hidden />
              {post.mediaCount}
            </Badge>
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {post.excerpt === "" ? "No content yet." : post.excerpt}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.targets.length > 0 ? (
            <span>
              {post.targets.map((target) => target.platformLabel).join(", ")}
            </span>
          ) : (
            <span>No destinations yet</span>
          )}
          <span>
            {post.scheduledAt
              ? `Scheduled ${formatShortDate(post.scheduledAt)}`
              : `Created ${formatShortDate(post.createdAt)}`}
          </span>
        </div>
      </Link>
    </li>
  );
}
