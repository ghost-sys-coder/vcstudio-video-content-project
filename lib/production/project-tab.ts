/**
 * Which project tab a path belongs to.
 *
 * Extracted from the header so the bookmark guarantee is testable: every route
 * that existed before the tabs were grouped must still resolve to a tab whose
 * content is that route.
 *
 * A tab is not the same thing as a route. Scenes and Storyboard are two views
 * of one scene context, and Render and Subtitles are two views of assembly, so
 * those pairs share a tab and switch between views inside it. Both routes in a
 * pair stay addressable, which is what keeps existing links and bookmarks
 * working.
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

export type ProjectStageSegment = (typeof PROJECT_STAGE_SEGMENTS)[number];

export type ProjectTab =
  | typeof PROJECT_OVERVIEW_TAB
  | "script"
  | "scenes"
  | "audio"
  | "assembly"
  | "publish"
  | "settings";

export interface ProjectTabGroup {
  id: ProjectTab;
  label: string;
  /** The route the tab itself opens. Null means the project root. */
  segment: ProjectStageSegment | null;
  /** Every route this tab owns, including the views it switches between. */
  segments: readonly ProjectStageSegment[];
}

export const PROJECT_TABS: readonly ProjectTabGroup[] = [
  {
    id: PROJECT_OVERVIEW_TAB,
    label: "Overview",
    segment: null,
    segments: [],
  },
  { id: "script", label: "Script", segment: "script", segments: ["script"] },
  {
    id: "scenes",
    label: "Scenes",
    segment: "scenes",
    segments: ["scenes", "storyboard"],
  },
  { id: "audio", label: "Audio", segment: "audio", segments: ["audio"] },
  {
    id: "assembly",
    label: "Assembly",
    segment: "render",
    segments: ["render", "subtitles"],
  },
  {
    id: "publish",
    label: "Publish",
    segment: "publish",
    segments: ["publish"],
  },
  {
    id: "settings",
    label: "Settings",
    segment: "settings",
    segments: ["settings"],
  },
];

/** The stage segment a path ends in, or null for the project root. */
export function resolveProjectSegment(
  pathname: string,
): ProjectStageSegment | null {
  return (
    PROJECT_STAGE_SEGMENTS.find((candidate) =>
      pathname.endsWith(`/${candidate}`),
    ) ?? null
  );
}

export function resolveProjectTab(pathname: string): ProjectTab {
  const segment = resolveProjectSegment(pathname);
  if (!segment) return PROJECT_OVERVIEW_TAB;
  return (
    PROJECT_TABS.find((tab) => tab.segments.includes(segment))?.id ??
    PROJECT_OVERVIEW_TAB
  );
}

/** The href a tab navigates to within one project. */
export function projectTabHref(projectId: string, tab: string): string {
  const group = PROJECT_TABS.find((candidate) => candidate.id === tab);
  const segment = group ? group.segment : null;
  return segment
    ? `/app/projects/${projectId}/${segment}`
    : `/app/projects/${projectId}`;
}
