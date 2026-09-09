/**
 * Which project tab a path belongs to.
 *
 * Extracted from the header so the bookmark guarantee is testable: every route
 * that existed before the overview was added must still resolve to the tab it
 * always resolved to.
 */

/** The overview has no path segment of its own; it is the project root. */
export const PROJECT_OVERVIEW_TAB = "overview";

/** Every stage that owns a path segment under the project. */
export const PROJECT_STAGE_SEGMENTS = [
  "script",
  "scenes",
  "storyboard",
  "audio",
  "subtitles",
  "render",
  "publish",
  "settings",
] as const;

export type ProjectTab =
  typeof PROJECT_OVERVIEW_TAB | (typeof PROJECT_STAGE_SEGMENTS)[number];

export function resolveProjectTab(pathname: string): ProjectTab {
  const segment = PROJECT_STAGE_SEGMENTS.find((candidate) =>
    pathname.endsWith(`/${candidate}`),
  );
  return segment ?? PROJECT_OVERVIEW_TAB;
}

/** The href a tab navigates to within one project. */
export function projectTabHref(projectId: string, tab: string): string {
  return tab === PROJECT_OVERVIEW_TAB
    ? `/app/projects/${projectId}`
    : `/app/projects/${projectId}/${tab}`;
}
