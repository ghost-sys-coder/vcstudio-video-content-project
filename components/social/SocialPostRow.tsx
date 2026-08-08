import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { DeleteDraftPostDialog } from "@/components/social/DeleteDraftPostDialog";
import { PostStatusBadge } from "@/components/social/PostStatusBadge";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/format/date";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export function SocialPostRow({
  canDeleteDraft = false,
  composerBasePath = "/app/social/posts",
  post,
}: {
  canDeleteDraft?: boolean;
  composerBasePath?: string;
  post: SocialPostSummaryView;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border p-1 transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
      <Link
        className="min-w-0 flex-1 rounded-lg p-2 focus-visible:outline-none"
        href={`${composerBasePath}/${post.id}`}
      >
        <div className="flex flex-col gap-2">
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
        </div>
      </Link>
      {canDeleteDraft && post.status === "draft" ? (
        <div className="shrink-0 pr-2">
          <DeleteDraftPostDialog postId={post.id} postName={post.name} />
        </div>
      ) : null}
    </li>
  );
}
