import { redirect } from "next/navigation";
import { FacebookPageSelector } from "@/components/publish/FacebookPageSelector";
import { loadFacebookPageSelection } from "@/lib/publishing/facebook-page-selection";
import { connectFacebookPageAction, findFacebookPageAction } from "./actions";

export default async function FacebookPageSelectionPage() {
  const { session, provider } = await loadFacebookPageSelection();
  let pages;
  try {
    pages = await provider.listPages(session.userAccessToken);
  } catch {
    redirect("/app/social/accounts?facebook=failed");
  }
  return (
    <FacebookPageSelector
      action={connectFacebookPageAction}
      findAction={findFacebookPageAction}
      pages={pages.map(({ externalAccountId, externalAccountName }) => ({
        externalAccountId,
        externalAccountName,
      }))}
    />
  );
}
