import { describe, expect, it } from "vitest";
import {
  PROJECT_STAGE_SEGMENTS,
  projectTabHref,
  resolveProjectTab,
} from "@/lib/production/project-tab";

const PROJECT = "0f0e2f4a-9c1e-4c8e-9a0e-2f4a9c1e4c8e";

describe("resolveProjectTab", () => {
  it("keeps every pre-existing route on the tab it always had", () => {
    // The bookmark guarantee: adding the overview must not move any route
    // that already existed to a different tab.
    for (const segment of PROJECT_STAGE_SEGMENTS)
      expect(resolveProjectTab(`/app/projects/${PROJECT}/${segment}`)).toBe(
        segment,
      );
  });

  it("treats the project root as the overview", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}`)).toBe("overview");
  });

  it("ignores a trailing slash on the root", () => {
    // A trailing slash must not be mistaken for a stage segment.
    expect(resolveProjectTab(`/app/projects/${PROJECT}/`)).toBe("overview");
  });

  it("does not match a segment that merely ends with a stage name", () => {
    expect(resolveProjectTab(`/app/projects/${PROJECT}/postscript`)).toBe(
      "overview",
    );
  });
});

describe("projectTabHref", () => {
  it("sends the overview to the project root, with no trailing segment", () => {
    expect(projectTabHref(PROJECT, "overview")).toBe(
      `/app/projects/${PROJECT}`,
    );
  });

  it("round-trips every stage tab through its own href", () => {
    for (const segment of PROJECT_STAGE_SEGMENTS) {
      const href = projectTabHref(PROJECT, segment);
      expect(href).toBe(`/app/projects/${PROJECT}/${segment}`);
      expect(resolveProjectTab(href)).toBe(segment);
    }
  });
});
