import { Button } from "@/components/ui/button";
import type { FacebookPage } from "@/lib/publishing/providers/facebook-video-publish-provider";

export function FacebookPageSelector({
  action,
  pages,
}: {
  action: (formData: FormData) => void | Promise<void>;
  pages: FacebookPage[];
}) {
  return (
    <section className="app-page app-form-page">
      <header className="app-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Facebook publishing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Choose a Page</h1>
        <p className="text-muted-foreground">
          Select the Facebook Page this workspace may publish videos to.
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
              <p className="text-sm text-muted-foreground">Facebook Page</p>
            </div>
            <form action={action}>
              <input
                name="pageId"
                type="hidden"
                value={page.externalAccountId}
              />
              <Button type="submit">Connect Page</Button>
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
    </section>
  );
}
