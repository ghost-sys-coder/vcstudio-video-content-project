import { describe, expect, it } from "vitest";
import {
  findSceneMergeNeighbours,
  type SceneMergeCandidateRow,
} from "@/lib/scenes/scene-merge-neighbours";

function rows(count: number): SceneMergeCandidateRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    sceneId: `scene-${index + 1}`,
    sceneNumber: index + 1,
    narrationText: `Passage ${index + 1}.`,
    hasApprovedImages: false,
    hasGeneratedWork: false,
  }));
}

describe("findSceneMergeNeighbours", () => {
  it("offers both sides for a scene in the middle", () => {
    const found = findSceneMergeNeighbours({ sceneNumber: 3, rows: rows(5) });
    expect(found.map((one) => one.sceneNumber)).toEqual([2, 4]);
  });

  it("offers only the next scene for the first", () => {
    const found = findSceneMergeNeighbours({ sceneNumber: 1, rows: rows(5) });
    expect(found.map((one) => one.sceneNumber)).toEqual([2]);
  });

  it("offers only the previous scene for the last", () => {
    const found = findSceneMergeNeighbours({ sceneNumber: 5, rows: rows(5) });
    expect(found.map((one) => one.sceneNumber)).toEqual([4]);
  });

  it("offers nothing when the scene stands alone", () => {
    expect(findSceneMergeNeighbours({ sceneNumber: 1, rows: rows(1) })).toEqual(
      [],
    );
  });

  // Merging non-neighbours would leave the passage between them narrated twice
  // or not at all, so distance two is not a near miss to be rounded down.
  it("never offers a scene two positions away", () => {
    const found = findSceneMergeNeighbours({ sceneNumber: 1, rows: rows(5) });
    expect(found.some((one) => one.sceneNumber === 3)).toBe(false);
  });

  it("never offers the scene itself", () => {
    const found = findSceneMergeNeighbours({ sceneNumber: 2, rows: rows(3) });
    expect(found.some((one) => one.sceneNumber === 2)).toBe(false);
  });

  it("lists the earlier neighbour first whatever order the rows arrive in", () => {
    const reversed = [...rows(5)].reverse();
    const found = findSceneMergeNeighbours({ sceneNumber: 3, rows: reversed });
    expect(found.map((one) => one.sceneNumber)).toEqual([2, 4]);
  });

  it("collapses whitespace in the preview so the option stays one line", () => {
    const found = findSceneMergeNeighbours({
      sceneNumber: 1,
      rows: [
        ...rows(1),
        {
          sceneId: "scene-2",
          sceneNumber: 2,
          narrationText: "  Two\n\nfish.  ",
          hasApprovedImages: false,
          hasGeneratedWork: false,
        },
      ],
    });
    expect(found[0]?.narrationPreview).toBe("Two fish.");
  });

  it("truncates a long passage rather than filling the dialog", () => {
    const found = findSceneMergeNeighbours({
      sceneNumber: 1,
      rows: [
        ...rows(1),
        {
          sceneId: "scene-2",
          sceneNumber: 2,
          narrationText: "word ".repeat(200),
          hasApprovedImages: false,
          hasGeneratedWork: false,
        },
      ],
    });
    expect(found[0]?.narrationPreview.endsWith("…")).toBe(true);
    expect(found[0]?.narrationPreview.length).toBeLessThanOrEqual(121);
  });

  it("carries through whether a neighbour has work worth warning about", () => {
    const found = findSceneMergeNeighbours({
      sceneNumber: 1,
      rows: [
        ...rows(1),
        {
          sceneId: "scene-2",
          sceneNumber: 2,
          narrationText: "Two fish.",
          hasApprovedImages: true,
          hasGeneratedWork: true,
        },
      ],
    });
    expect(found[0]?.hasApprovedImages).toBe(true);
    expect(found[0]?.hasGeneratedWork).toBe(true);
  });
});
