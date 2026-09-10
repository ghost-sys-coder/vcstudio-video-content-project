import Link from "next/link";
import {
  workspaceViewHref,
  type WorkspaceView,
} from "@/lib/production/workspace-views";

/**
 * Switches between the views of one production context.
 *
 * These are real links to real routes, not in-page tabs, so they are marked up
 * as navigation with `aria-current` rather than as an ARIA tablist. That choice
 * is deliberate: it keeps bookmarking, opening in a new tab, and the browser's
 * back button working, and it lets the scene editor's unsaved-changes guard,
 * which watches link clicks, catch a view change like any other navigation.
 */
export function WorkspaceViewSwitch({
  projectId,
  views,
  activeViewId,
  search,
}: {
  projectId: string;
  views: readonly WorkspaceView[];
  activeViewId: string;
  search?: string;
}) {
  const active = views.find((view) => view.id === activeViewId) ?? views[0];

  return (
    <div className="space-y-1.5">
      <nav aria-label="Workspace views">
        <ul className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {views.map((view) => {
            const current = view.id === active.id;
            return (
              <li key={view.id}>
                <Link
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    current
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  href={workspaceViewHref({ projectId, view, search })}
                >
                  {view.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-xs text-muted-foreground">{active.description}</p>
    </div>
  );
}
