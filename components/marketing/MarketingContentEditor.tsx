import { updateMarketingContentAction } from "@/app/(authenticated)/app/marketing/content/actions";
import { Button } from "@/components/ui/button";
import type { MarketingContentItem } from "@/db/schema";
export function MarketingContentEditor({
  item,
}: {
  item: MarketingContentItem;
}) {
  const editable = ["draft", "needs_review", "changes_requested"].includes(
    item.status,
  );
  const isGraphic = item.kind === "graphic";
  if (!editable)
    return (
      <div className="whitespace-pre-wrap rounded-xl border p-4 text-sm">
        {item.bodyPlainText}
      </div>
    );
  return (
    <form
      action={async (formData) => {
        "use server";
        await updateMarketingContentAction(formData);
      }}
      className="space-y-4"
    >
      <input name="contentItemId" type="hidden" value={item.id} />
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">
          Title
        </label>
        <input
          className="h-10 w-full rounded-lg border bg-background px-3"
          defaultValue={item.title}
          id="title"
          name="title"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="body">
          {isGraphic ? "Supporting caption or context" : "Draft"}
        </label>
        <textarea
          className={`${isGraphic ? "min-h-32" : "min-h-80"} w-full rounded-lg border bg-background p-3 text-sm`}
          defaultValue={item.bodyPlainText}
          id="body"
          name="body"
        />
      </div>
      <Button type="submit">Save revision</Button>
    </form>
  );
}
