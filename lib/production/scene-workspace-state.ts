import { sceneStatusEnum } from "@/db/schema";
import type { SceneStatusFilter } from "@/lib/scenes/scene-navigation";
import {
  STORYBOARD_FILTERS,
  type StoryboardFilter,
} from "@/lib/scenes/storyboard-filter";

/**
 * The state both scene views share.
 *
 * Scene detail and the image grid are two views of one context, so the scene
 * a creator is looking at and the filters they narrowed to have to survive the
 * change between them. Holding that state in the query string is what makes it
 * survive: component state would be discarded by the navigation, and the URL
 * additionally survives a reload and can be handed to someone else.
 *
 * Every field is optional and every unrecognised value falls back to its
 * default. This is untrusted input from the address bar, and a filter that
 * cannot be honoured must show the creator everything rather than fail.
 */
export interface SceneWorkspaceState {
  /** The scene being worked on, by its number within the project. */
  sceneNumber: number | null;
  /** The detail view's free-text search. */
  query: string;
  /** The detail view's scene-status filter. */
  status: SceneStatusFilter;
  /** The grid view's image-state filter. */
  filter: StoryboardFilter;
}

export const EMPTY_SCENE_WORKSPACE_STATE: SceneWorkspaceState = {
  sceneNumber: null,
  query: "",
  status: "all",
  filter: "all",
};

/** How Next.js hands a route its query string. */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

const SCENE_STATUS_FILTERS: readonly SceneStatusFilter[] = [
  "all",
  ...sceneStatusEnum.enumValues,
];

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function isSceneStatusFilter(value: string): value is SceneStatusFilter {
  return SCENE_STATUS_FILTERS.some((candidate) => candidate === value);
}

function isStoryboardFilter(value: string): value is StoryboardFilter {
  return STORYBOARD_FILTERS.some((option) => option.value === value);
}

export function readSceneWorkspaceState(
  params: SearchParamsInput,
): SceneWorkspaceState {
  const sceneNumber = Number(single(params.scene));
  const status = single(params.status);
  const filter = single(params.filter);
  return {
    sceneNumber:
      Number.isInteger(sceneNumber) && sceneNumber > 0 ? sceneNumber : null,
    // Trimmed so a query of only spaces does not survive as a filter that
    // silently matches nothing.
    query: single(params.q).trim(),
    status: isSceneStatusFilter(status) ? status : "all",
    filter: isStoryboardFilter(filter) ? filter : "all",
  };
}

/**
 * The query string for a state, defaults omitted.
 *
 * Omitting defaults keeps an untouched workspace's URL clean, so the address
 * bar only ever shows the choices a creator actually made.
 */
export function sceneWorkspaceSearch(state: SceneWorkspaceState): string {
  const params = new URLSearchParams();
  if (state.sceneNumber !== null)
    params.set("scene", String(state.sceneNumber));
  if (state.query) params.set("q", state.query);
  if (state.status !== "all") params.set("status", state.status);
  if (state.filter !== "all") params.set("filter", state.filter);
  const search = params.toString();
  return search ? `?${search}` : "";
}
