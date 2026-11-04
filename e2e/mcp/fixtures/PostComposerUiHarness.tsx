import { PostComposer } from "@/components/social/PostComposer";
import { composerFixture } from "./social-draft-data";
export function PostComposerUiHarness() {
  return (
    <PostComposer
      canPublish
      canUpload={false}
      maxImageBytes={1024}
      maxVideoBytes={1024}
      workspaceId="11111111-1111-4111-8111-111111111111"
      view={composerFixture()}
    />
  );
}
