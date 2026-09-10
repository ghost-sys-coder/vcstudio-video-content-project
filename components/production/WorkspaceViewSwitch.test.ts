import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceViewSwitch } from "@/components/production/WorkspaceViewSwitch";
import {
  ASSEMBLY_WORKSPACE_VIEWS,
  SCENE_WORKSPACE_VIEWS,
} from "@/lib/production/workspace-views";

const PROJECT = "0f0e2f4a-9c1e-4c8e-9a0e-2f4a9c1e4c8e";

function render(props: {
  activeViewId: string;
  views: typeof SCENE_WORKSPACE_VIEWS;
  search?: string;
}) {
  return renderToStaticMarkup(
    createElement(WorkspaceViewSwitch, { projectId: PROJECT, ...props }),
  );
}

describe("WorkspaceViewSwitch", () => {
  it("offers every view of the context as a real link", () => {
    // Real links are what keep bookmarking, opening in a new tab, and the
    // unsaved-work guard working across a change of view.
    const html = render({
      activeViewId: "detail",
      views: SCENE_WORKSPACE_VIEWS,
    });
    for (const view of SCENE_WORKSPACE_VIEWS) {
      expect(html).toContain(view.label);
      expect(html).toContain(`href="/app/projects/${PROJECT}/${view.segment}`);
    }
  });

  it("marks the current view for assistive technology", () => {
    const html = render({ activeViewId: "grid", views: SCENE_WORKSPACE_VIEWS });
    expect(html).toContain('aria-current="page"');
    // Exactly one, or the current position is meaningless.
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("carries the shared state into the other view", () => {
    const html = render({
      activeViewId: "detail",
      views: SCENE_WORKSPACE_VIEWS,
      search: "?scene=6&filter=needsReview",
    });
    expect(html).toContain(
      `/app/projects/${PROJECT}/storyboard?scene=6&amp;filter=needsReview`,
    );
  });

  it("describes what the active view is for", () => {
    expect(
      render({ activeViewId: "captions", views: ASSEMBLY_WORKSPACE_VIEWS }),
    ).toContain("Review caption wording");
  });

  it("labels its navigation", () => {
    expect(
      render({ activeViewId: "preview", views: ASSEMBLY_WORKSPACE_VIEWS }),
    ).toContain('aria-label="Workspace views"');
  });

  it("falls back to the first view when the active id is unknown", () => {
    const html = render({
      activeViewId: "nonsense",
      views: SCENE_WORKSPACE_VIEWS,
    });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain(SCENE_WORKSPACE_VIEWS[0].description);
  });
});
