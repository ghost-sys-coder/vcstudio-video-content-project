import { CreatePostButton } from "@/components/social/CreatePostButton";
import { EmptyPostsState } from "@/components/social/EmptyPostsState";
import { SocialPostRow } from "@/components/social/SocialPostRow";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export function SocialPostsWorkspace({
  canCompose,
  posts,
}: {
  canCompose: boolean;
  posts: SocialPostSummaryView[];
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Write once, send to several connected accounts.
          </p>
        </div>
        {canCompose ? <CreatePostButton /> : null}
      </header>

      {posts.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <SocialPostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}
