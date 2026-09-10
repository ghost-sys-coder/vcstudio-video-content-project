import { describe, expect, it } from "vitest";
import {
  EMPTY_SCENE_WORKSPACE_STATE,
  readSceneWorkspaceState,
  sceneWorkspaceSearch,
} from "@/lib/production/scene-workspace-state";

describe("readSceneWorkspaceState", () => {
  it("reads every shared field", () => {
    expect(
      readSceneWorkspaceState({
        scene: "4",
        q: "opening",
        status: "approved",
        filter: "needsReview",
      }),
    ).toEqual({
      sceneNumber: 4,
      query: "opening",
      status: "approved",
      filter: "needsReview",
    });
  });

  it("defaults an absent query string to showing everything", () => {
    expect(readSceneWorkspaceState({})).toEqual(EMPTY_SCENE_WORKSPACE_STATE);
  });

  it("falls back rather than trusting a value from the address bar", () => {
    // A filter nobody can satisfy must show every scene, not none of them.
    expect(
      readSceneWorkspaceState({
        scene: "-2",
        status: "deleted",
        filter: "everything",
      }),
    ).toEqual(EMPTY_SCENE_WORKSPACE_STATE);
  });

  it("rejects a scene number that is not a whole positive number", () => {
    for (const scene of ["0", "1.5", "abc", "", "1e3000"])
      expect(readSceneWorkspaceState({ scene }).sceneNumber).not.toBe(
        Number(scene),
      );
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(readSceneWorkspaceState({ scene: ["3", "9"] }).sceneNumber).toBe(3);
  });

  it("does not keep a search of only whitespace", () => {
    // It would otherwise persist in the URL and match nothing.
    expect(readSceneWorkspaceState({ q: "   " }).query).toBe("");
  });
});

describe("sceneWorkspaceSearch", () => {
  it("writes nothing when nothing was chosen", () => {
    expect(sceneWorkspaceSearch(EMPTY_SCENE_WORKSPACE_STATE)).toBe("");
  });

  it("writes only the choices that were made", () => {
    expect(
      sceneWorkspaceSearch({
        ...EMPTY_SCENE_WORKSPACE_STATE,
        sceneNumber: 7,
      }),
    ).toBe("?scene=7");
  });

  it("round-trips every field through the query string", () => {
    const state = {
      sceneNumber: 12,
      query: "a & b",
      status: "revisionRequired" as const,
      filter: "failed" as const,
    };
    const search = sceneWorkspaceSearch(state);
    const params = Object.fromEntries(
      new URLSearchParams(search.slice(1)).entries(),
    );
    expect(readSceneWorkspaceState(params)).toEqual(state);
  });

  it("escapes a search that contains query-string punctuation", () => {
    const search = sceneWorkspaceSearch({
      ...EMPTY_SCENE_WORKSPACE_STATE,
      query: "a=b&c",
    });
    expect(search).toBe("?q=a%3Db%26c");
    expect(
      readSceneWorkspaceState(
        Object.fromEntries(new URLSearchParams(search.slice(1)).entries()),
      ).query,
    ).toBe("a=b&c");
  });
});
