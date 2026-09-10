import type { ProjectStageSegment } from "@/lib/production/project-tab";

/**
 * The views inside a grouped tab.
 *
 * Scenes and Storyboard were separate tabs, as were Render and Subtitles, so a
 * creator had to know which of eight tabs held the thing they wanted. Each pair
 * is really one context seen two ways, so they are now one tab with a view
 * switch. Each view keeps its own route, which is what makes existing links,
 * bookmarks, and `revalidatePath` calls keep working unchanged.
 */
export interface WorkspaceView {
  id: string;
  label: string;
  segment: ProjectStageSegment;
  /** What this view is for, shown under the switch. */
  description: string;
}

export const SCENE_WORKSPACE_VIEWS: readonly WorkspaceView[] = [
  {
    id: "detail",
    label: "Scene detail",
    segment: "scenes",
    description: "Read and edit one scene at a time.",
  },
  {
    id: "grid",
    label: "Image grid",
    segment: "storyboard",
    description: "Generate and review scene images together.",
  },
];

export const ASSEMBLY_WORKSPACE_VIEWS: readonly WorkspaceView[] = [
  {
    id: "preview",
    label: "Preview & render",
    segment: "render",
    description: "Check the assembled video and render it.",
  },
  {
    id: "captions",
    label: "Captions",
    segment: "subtitles",
    description: "Review caption wording, timing, and style.",
  },
];

/**
 * The href for one view, carrying whatever shared state the current view holds.
 *
 * The state travels in the query string rather than in memory so that it
 * survives the view change, a reload, and a shared link alike.
 */
export function workspaceViewHref(input: {
  projectId: string;
  view: WorkspaceView;
  search?: string;
}): string {
  const base = `/app/projects/${input.projectId}/${input.view.segment}`;
  const search = input.search ?? "";
  if (!search) return base;
  return `${base}${search.startsWith("?") ? search : `?${search}`}`;
}

/** Which view a route belongs to, or the first view when it belongs to none. */
export function resolveWorkspaceView(
  views: readonly WorkspaceView[],
  pathname: string,
): WorkspaceView {
  return (
    views.find((view) => pathname.endsWith(`/${view.segment}`)) ?? views[0]
  );
}
