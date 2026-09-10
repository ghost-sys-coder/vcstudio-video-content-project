import { describe, expect, it } from "vitest";
import {
  PROJECT_STAGE_SEGMENTS,
  PROJECT_TABS,
  projectTabHref,
  resolveProjectSegment,
  resolveProjectTab,
} from "@/lib/production/project-tab";

const PROJECT = "0f0e2f4a-9c1e-4c8e-9a0e-2f4a9c1e4c8e";

describe("resolveProjectTab", () => {
  it("keeps every pre-existing route on a tab that owns it", () => {
    // The bookmark guarantee. Grouping Scenes with Storyboard, and Render with
    // Subtitles, must not leave any route stranded on a tab whose content is
    // something else.
    for (const segment of PROJECT_STAGE_SEGMENTS) {
      const tab = resolveProjectTab(`/app/projects/${PROJECT}/${segment}`);
      const group = PROJECT_TABS.find((candidate) => candidate.id === tab);
      expect(group?.segments).toContain(segment);
    }
  });

  it("shows the scene tab for both of its views", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}/scenes`)).toBe("scenes");
    expect(resolveProjectTab(`/app/projects/${PROJECT}/storyboard`)).toBe(
      "scenes",
    );
  });

  it("shows the assembly tab for both of its views", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}/render`)).toBe(
      "assembly",
    );
    expect(resolveProjectTab(`/app/projects/${PROJECT}/subtitles`)).toBe(
      "assembly",
    );
  });

  it("treats the project root as the overview", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}`)).toBe("overview");
  });

  it("ignores a trailing slash on the root", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}/`)).toBe("overview");
  });

  it("does not match a segment that merely ends with a stage name", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}/postscript`)).toBe(
      "overview",
    );
    expect(resolveProjectSegment(`/app/projects/${PROJECT}/postscript`)).toBe(
      null,
    );
  });
});

describe("the tab register", () => {
  it("owns every stage segment exactly once", () => {
    // Two tabs claiming one route would make the highlighted tab depend on
    // list order rather than on where the creator actually is.
    const owned = PROJECT_TABS.flatMap((tab) => tab.segments);
    expect([...owned].sort()).toEqual([...PROJECT_STAGE_SEGMENTS].sort());
    expect(new Set(owned).size).toBe(owned.length);
  });

  it("is shorter than the eight tabs it replaces", () => {
    // The point of the slice: the workflow has to be navigable without knowing
    // every stage tab.
    expect(PROJECT_TABS.length).toBeLessThan(PROJECT_STAGE_SEGMENTS.length + 1);
  });

  it("opens each tab on a route that tab owns", () => {
    for (const tab of PROJECT_TABS) {
      if (!tab.segment) continue;
      expect(tab.segments).toContain(tab.segment);
    }
  });
});

describe("projectTabHref", () => {
  it("sends the overview to the project root, with no trailing segment", () => {
    expect(projectTabHref(PROJECT, "overview")).toBe(
      `/app/projects/${PROJECT}`,
    );
  });

  it("round-trips every tab through its own href", () => {
    for (const tab of PROJECT_TABS)
      expect(resolveProjectTab(projectTabHref(PROJECT, tab.id))).toBe(tab.id);
  });

  it("falls back to the project root for an unknown tab", () => {
    expect(projectTabHref(PROJECT, "nonsense")).toBe(
      `/app/projects/${PROJECT}`,
    );
  });
});
