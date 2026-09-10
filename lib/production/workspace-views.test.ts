import { describe, expect, it } from "vitest";
import { PROJECT_TABS, resolveProjectTab } from "@/lib/production/project-tab";
import {
  ASSEMBLY_WORKSPACE_VIEWS,
  SCENE_WORKSPACE_VIEWS,
  resolveWorkspaceView,
  workspaceViewHref,
} from "@/lib/production/workspace-views";

const PROJECT = "0f0e2f4a-9c1e-4c8e-9a0e-2f4a9c1e4c8e";

const GROUPS = [
  { tab: "scenes", views: SCENE_WORKSPACE_VIEWS },
  { tab: "assembly", views: ASSEMBLY_WORKSPACE_VIEWS },
] as const;

describe("the views of a grouped tab", () => {
  it("all belong to the tab that contains them", () => {
    // A view whose route sat on another tab would move the highlight when a
    // creator switched views, which is exactly the confusion being removed.
    for (const group of GROUPS)
      for (const view of group.views)
        expect(
          resolveProjectTab(`/app/projects/${PROJECT}/${view.segment}`),
        ).toBe(group.tab);
  });

  it("covers every route that tab owns", () => {
    for (const group of GROUPS) {
      const tab = PROJECT_TABS.find((candidate) => candidate.id === group.tab);
      expect(group.views.map((view) => view.segment).sort()).toEqual(
        [...(tab?.segments ?? [])].sort(),
      );
    }
  });

  it("opens on the view the tab itself points at", () => {
    for (const group of GROUPS) {
      const tab = PROJECT_TABS.find((candidate) => candidate.id === group.tab);
      expect(group.views[0]?.segment).toBe(tab?.segment);
    }
  });
});

describe("workspaceViewHref", () => {
  it("points at the view's own route", () => {
    expect(
      workspaceViewHref({ projectId: PROJECT, view: SCENE_WORKSPACE_VIEWS[1] }),
    ).toBe(`/app/projects/${PROJECT}/storyboard`);
  });

  it("carries the shared state across the change of view", () => {
    expect(
      workspaceViewHref({
        projectId: PROJECT,
        view: SCENE_WORKSPACE_VIEWS[1],
        search: "?scene=3&status=approved",
      }),
    ).toBe(`/app/projects/${PROJECT}/storyboard?scene=3&status=approved`);
  });

  it("accepts a search with or without its leading question mark", () => {
    const view = SCENE_WORKSPACE_VIEWS[0];
    expect(
      workspaceViewHref({ projectId: PROJECT, view, search: "scene=3" }),
    ).toBe(workspaceViewHref({ projectId: PROJECT, view, search: "?scene=3" }));
  });

  it("leaves the href clean when there is no state to carry", () => {
    expect(
      workspaceViewHref({
        projectId: PROJECT,
        view: SCENE_WORKSPACE_VIEWS[0],
        search: "",
      }),
    ).toBe(`/app/projects/${PROJECT}/scenes`);
  });
});

describe("resolveWorkspaceView", () => {
  it("finds the view a route belongs to", () => {
    expect(
      resolveWorkspaceView(
        ASSEMBLY_WORKSPACE_VIEWS,
        `/app/projects/${PROJECT}/subtitles`,
      ).id,
    ).toBe("captions");
  });

  it("falls back to the first view for an unrelated path", () => {
    expect(
      resolveWorkspaceView(SCENE_WORKSPACE_VIEWS, `/app/projects/${PROJECT}`)
        .id,
    ).toBe("detail");
  });
});
