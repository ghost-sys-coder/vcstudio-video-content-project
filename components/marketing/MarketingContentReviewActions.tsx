import {
  handoffMarketingContentAction,
  reviewMarketingContentAction,
} from "@/app/(authenticated)/app/marketing/content/actions";
import { Button } from "@/components/ui/button";
import type { MarketingContentItem } from "@/db/schema";
export function MarketingContentReviewActions({
  item,
}: {
  item: MarketingContentItem;
}) {
  if (
    item.status === "approved" &&
    !item.socialPostId &&
    ["social_post", "graphic", "media_story"].includes(item.kind)
  )
    return (
      <form
        action={async (formData) => {
          "use server";
          await handoffMarketingContentAction(formData);
        }}
      >
        <input name="contentItemId" type="hidden" value={item.id} />
        <Button type="submit">Open as Social draft</Button>
      </form>
    );
  if (item.status !== "needs_review") return null;
  return (
    <form
      action={async (formData) => {
        "use server";
        await reviewMarketingContentAction(formData);
      }}
      className="space-y-3"
    >
      <input name="contentItemId" type="hidden" value={item.id} />
      <label className="block text-sm font-medium" htmlFor="reviewNotes">
        Review notes
      </label>
      <textarea
        className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
        id="reviewNotes"
        name="reviewNotes"
      />
      <div className="flex flex-wrap gap-2">
        <Button name="decision" type="submit" value="approve">
          Approve
        </Button>
        <Button
          name="decision"
          type="submit"
          value="request_changes"
          variant="outline"
        >
          Request changes
        </Button>
        <Button name="decision" type="submit" value="archive" variant="ghost">
          Archive
        </Button>
      </div>
    </form>
  );
}
