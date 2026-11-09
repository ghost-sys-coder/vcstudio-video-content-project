import { PostComposer } from "@/components/social/PostComposer";
import { composerFixture } from "./social-draft-data";
import { SocialPostRow } from "@/components/social/SocialPostRow";
export function PostComposerUiHarness() {
  if (new URLSearchParams(location.search).has("delete-card"))
    return (
      <ul className="app-grid">
        <SocialPostRow
          canDelete
          post={{
            id: "33333333-3333-4333-8333-333333333333",
            name: "Saved destination test",
            status: "published",
            excerpt: "A relevant published post.",
            mediaCount: 1,
            createdAt: "2026-11-09T12:00:00Z",
            scheduledAt: null,
            scheduledTimezone: "UTC",
            mediaPreviewUrl: null,
            mediaKind: "image",
            calendarAt: "2026-11-09T12:00:00Z",
            targets: [],
          }}
        />
      </ul>
    );
  return (
    <PostComposer
      canPublish
      canUpload
      maxImageBytes={25 * 1024 * 1024}
      maxVideoBytes={512 * 1024 * 1024}
      workspaceId="11111111-1111-4111-8111-111111111111"
      view={composerFixture()}
    />
  );
}
