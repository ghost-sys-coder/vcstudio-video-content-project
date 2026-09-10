import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryboardSceneLink } from "@/components/storyboard/StoryboardSceneLink";
import { EMPTY_SCENE_WORKSPACE_STATE } from "@/lib/production/scene-workspace-state";

const PROJECT = "0f0e2f4a-9c1e-4c8e-9a0e-2f4a9c1e4c8e";

function render(sceneNumber: number, state = EMPTY_SCENE_WORKSPACE_STATE) {
  return renderToStaticMarkup(
    createElement(StoryboardSceneLink, {
      projectId: PROJECT,
      sceneNumber,
      workspaceState: state,
    }),
  );
}

describe("StoryboardSceneLink", () => {
  it("opens the scene it belongs to, not the one that was open", () => {
    const html = render(9, {
      ...EMPTY_SCENE_WORKSPACE_STATE,
      sceneNumber: 2,
    });
    expect(html).toContain(`/app/projects/${PROJECT}/scenes?scene=9`);
    expect(html).not.toContain("scene=2");
  });

  it("keeps the grid's filters so coming back is not a reset", () => {
    const html = render(3, {
      sceneNumber: 1,
      query: "reset",
      status: "approved",
      filter: "needsReview",
    });
    expect(html).toContain("scene=3");
    expect(html).toContain("q=reset");
    expect(html).toContain("status=approved");
    expect(html).toContain("filter=needsReview");
  });

  it("names the scene it opens", () => {
    expect(render(4)).toContain("Open scene 4");
  });
});
