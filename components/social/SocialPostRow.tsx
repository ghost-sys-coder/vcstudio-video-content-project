import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { DeletePostDialog } from "@/components/social/DeletePostDialog";
import { PostStatusBadge } from "@/components/social/PostStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter } from "@/components/ui/card";
import { ScheduleCountdown } from "@/components/ui/ScheduleCountdown";
import { formatShortDate } from "@/lib/format/date";
import { SOCIAL_SWEEP_WINDOW_MINUTES } from "@/lib/social/schedule-window";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export function SocialPostRow({
  canDelete = false,
  composerBasePath = "/app/social/posts",
  post,
}: {
  canDelete?: boolean;
  composerBasePath?: string;
  post: SocialPostSummaryView;
}) {
  return (
    <li className="min-w-0">
      <Card className="h-full gap-0 py-0 shadow-sm transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
        <Link
          className="flex min-w-0 flex-1 flex-col rounded-2xl p-[var(--app-panel-padding)] focus-visible:outline-none"
          href={`${composerBasePath}/${post.id}`}
        >
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="line-clamp-2 w-full min-w-0 text-base font-semibold [overflow-wrap:anywhere]"
                title={post.name}
              >
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

            <p className="line-clamp-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {post.excerpt === "" ? "No content yet." : post.excerpt}
            </p>

            <div className="mt-auto flex flex-col items-start gap-2 border-t pt-4 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {post.targets.length > 0 ? (
                <span>
                  {post.targets
                    .map((target) => target.platformLabel)
                    .join(", ")}
                </span>
              ) : (
                <span>No destinations yet</span>
              )}
              <span>
                {post.scheduledAt
                  ? `Scheduled ${formatShortDate(post.scheduledAt)}`
                  : `Created ${formatShortDate(post.createdAt)}`}
              </span>
              {/* Only for a post still waiting: one already published or
                cancelled has nothing left to count down to. */}
              {post.scheduledAt && post.status === "scheduled" ? (
                <ScheduleCountdown
                  scheduledAt={post.scheduledAt}
                  sweepWindowMinutes={SOCIAL_SWEEP_WINDOW_MINUTES}
                />
              ) : null}
            </div>
          </div>
        </Link>
        {canDelete ? (
          <CardFooter className="justify-end py-2">
            <DeletePostDialog postId={post.id} postName={post.name} />
          </CardFooter>
        ) : null}
      </Card>
    </li>
  );
}
