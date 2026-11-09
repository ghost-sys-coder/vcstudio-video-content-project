import type {
  FacebookPageLookupState,
  FacebookPageOption,
} from "@studio/contracts/publishing";
import { FacebookPageConnectButton } from "@/components/publish/FacebookPageConnectButton";
import { FacebookPageLookup } from "@/components/publish/FacebookPageLookup";

export function FacebookPageSelector({
  action,
  findAction,
  pages,
}: {
  action: (formData: FormData) => void | Promise<void>;
  findAction: (
    previous: FacebookPageLookupState,
    formData: FormData,
  ) => Promise<FacebookPageLookupState>;
  pages: FacebookPageOption[];
}) {
  return (
    <section className="app-page app-form-page">
      <header className="app-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Facebook publishing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Choose a Page</h1>
        <p className="text-muted-foreground">
          Select the Facebook Page to connect for social posts and videos.
        </p>
      </header>
      <ul className="app-section">
        {pages.map((page) => (
          <li
            className="app-panel flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card"
            key={page.externalAccountId}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{page.externalAccountName}</p>
              <p className="break-all text-sm text-muted-foreground">
                Page ID: {page.externalAccountId}
              </p>
            </div>
            <form action={action}>
              <input
                name="pageId"
                type="hidden"
                value={page.externalAccountId}
              />
              <FacebookPageConnectButton />
            </form>
          </li>
        ))}
      </ul>
      {pages.length === 0 ? (
        <p className="app-panel rounded-xl border border-dashed text-sm text-muted-foreground">
          No manageable Facebook Pages were found. Confirm your Page role and
          grant all requested permissions.
        </p>
      ) : null}
      <FacebookPageLookup action={findAction} connectAction={action} />
    </section>
  );
}
