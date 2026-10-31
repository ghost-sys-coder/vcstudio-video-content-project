import { CreatePostButton } from "@/components/social/CreatePostButton";
import { EmptyPostsState } from "@/components/social/EmptyPostsState";
import { SocialPostRow } from "@/components/social/SocialPostRow";
import type { SocialPostSummaryView } from "@/lib/social/social-post-view";

export function SocialPostsWorkspace({
  canCompose,
  composerBasePath = "/app/social/posts",
  posts,
}: {
  canCompose: boolean;
  composerBasePath?: string;
  posts: SocialPostSummaryView[];
}) {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <div className="app-heading">
          <h1 className="text-xl font-semibold">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Write once, send to several connected accounts.
          </p>
        </div>
        {canCompose ? (
          <CreatePostButton composerBasePath={composerBasePath} />
        ) : null}
      </header>

      {posts.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <ul className="app-grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
          {posts.map((post) => (
            <SocialPostRow
              canDeleteDraft={canCompose}
              composerBasePath={composerBasePath}
              key={post.id}
              post={post}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
