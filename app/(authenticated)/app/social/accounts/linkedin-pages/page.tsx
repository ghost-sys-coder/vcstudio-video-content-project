import { redirect } from "next/navigation";
import { LinkedInPageSelector } from "@/components/publish/LinkedInPageSelector";
import {
  loadLinkedInPagesSelection,
  LinkedInPageSelectionError,
} from "@/lib/publishing/linkedin-pages-selection";
import { linkedInPagesResultPath } from "@/lib/publishing/linkedin-pages-navigation";
import { linkedInPagesCursorSchema } from "@/lib/schemas/linkedin-pages";
import { connectLinkedInPageAction } from "./actions";

export default async function LinkedInPageSelectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const parsed = linkedInPagesCursorSchema.safeParse(query.start ?? 0);
  if (!parsed.success) redirect(linkedInPagesResultPath("invalid"));
  let result;
  try {
    result = await loadLinkedInPagesSelection(parsed.data);
  } catch (error) {
    redirect(
      linkedInPagesResultPath(
        error instanceof LinkedInPageSelectionError ? error.status : "failed",
      ),
    );
  }
  return (
    <LinkedInPageSelector
      key={result.start}
      action={connectLinkedInPageAction}
      pages={result.pages}
      start={result.start}
      nextStart={result.nextStart}
    />
  );
}
