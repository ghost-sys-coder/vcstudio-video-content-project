import { describe, expect, it } from "vitest";
import { orderStylePresetsForProject } from "@/lib/scenes/order-style-presets";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";

function preset(
  overrides: Partial<SceneImageStylePresetView> &
    Pick<SceneImageStylePresetView, "id" | "versionId">,
): SceneImageStylePresetView {
  return {
    name: overrides.id,
    description: "",
    version: 1,
    isDefault: false,
    positivePrompt: "a look",
    negativePrompt: "",
    defaultAspectRatio: "16:9",
    ...overrides,
  };
}

const WORKSPACE_DEFAULT = preset({
  id: "house",
  versionId: "house-v1",
  isDefault: true,
});
const PHOTOREAL = preset({ id: "photoreal", versionId: "photoreal-v3" });
const ANIME = preset({ id: "anime", versionId: "anime-v1" });

describe("which style a generate dialog should preselect", () => {
  it("puts the project's own style first, ahead of the workspace default", () => {
    const ordered = orderStylePresetsForProject(
      [WORKSPACE_DEFAULT, PHOTOREAL, ANIME],
      "photoreal-v3",
    );
    expect(ordered[0]?.versionId).toBe("photoreal-v3");
  });

  it("falls back to the workspace default when the project has no style", () => {
    const ordered = orderStylePresetsForProject(
      [PHOTOREAL, WORKSPACE_DEFAULT, ANIME],
      null,
    );
    expect(ordered[0]?.versionId).toBe("house-v1");
  });

  it("falls back to the workspace default when the project's style is gone", () => {
    // An archived style drops out of the list the dialog is given. The project
    // keeps citing it, so preselection must not land on nothing.
    const ordered = orderStylePresetsForProject(
      [PHOTOREAL, WORKSPACE_DEFAULT],
      "archived-version-id",
    );
    expect(ordered[0]?.versionId).toBe("house-v1");
  });
});

describe("what the ordering must not disturb", () => {
  it("keeps every style, dropping none", () => {
    const ordered = orderStylePresetsForProject(
      [WORKSPACE_DEFAULT, PHOTOREAL, ANIME],
      "photoreal-v3",
    );
    expect(ordered).toHaveLength(3);
    expect(new Set(ordered.map((entry) => entry.versionId)).size).toBe(3);
  });

  it("leaves the remaining order exactly as the repository gave it", () => {
    // The repository already sorts default-first then by name. Re-sorting the
    // tail would scramble a list people navigate by position.
    const ordered = orderStylePresetsForProject(
      [WORKSPACE_DEFAULT, PHOTOREAL, ANIME],
      "photoreal-v3",
    );
    expect(ordered.map((entry) => entry.versionId)).toEqual([
      "photoreal-v3",
      "house-v1",
      "anime-v1",
    ]);
  });

  it("does not mutate the list it was given", () => {
    const input = [WORKSPACE_DEFAULT, PHOTOREAL];
    orderStylePresetsForProject(input, "photoreal-v3");
    expect(input[0]?.versionId).toBe("house-v1");
  });

  it("handles an empty list", () => {
    expect(orderStylePresetsForProject([], "anything")).toEqual([]);
  });
});
