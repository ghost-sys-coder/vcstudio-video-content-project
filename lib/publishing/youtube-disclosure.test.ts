import { describe, expect, it } from "vitest";
import {
  areDisclosuresComplete,
  buildYouTubeStatusDisclosures,
  describeDisclosures,
  findMissingDisclosures,
  MADE_FOR_KIDS_GUIDANCE,
  SYNTHETIC_MEDIA_GUIDANCE,
  YOUTUBE_AUDIENCE_LABELS,
} from "@/lib/publishing/youtube-disclosure";

const undeclared = { madeForKids: null, containsSyntheticMedia: null };
const declared = { madeForKids: false, containsSyntheticMedia: true };

describe("no declaration is ever made on the creator's behalf", () => {
  it("refuses to build a status body while anything is unanswered", () => {
    // The defect this replaces: the upload sent selfDeclaredMadeForKids false
    // as a constant, declaring a legal position nobody had been asked about.
    expect(buildYouTubeStatusDisclosures(undeclared)).toBeNull();
    expect(
      buildYouTubeStatusDisclosures({
        madeForKids: false,
        containsSyntheticMedia: null,
      }),
    ).toBeNull();
    expect(
      buildYouTubeStatusDisclosures({
        madeForKids: null,
        containsSyntheticMedia: false,
      }),
    ).toBeNull();
  });

  it("distinguishes unanswered from answered no", () => {
    // These are different facts, and treating them alike is what caused this.
    expect(areDisclosuresComplete(undeclared)).toBe(false);
    expect(
      areDisclosuresComplete({
        madeForKids: false,
        containsSyntheticMedia: false,
      }),
    ).toBe(true);
  });

  it("sends exactly what was chosen, both ways round", () => {
    expect(buildYouTubeStatusDisclosures(declared)).toEqual({
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    });
    expect(
      buildYouTubeStatusDisclosures({
        madeForKids: true,
        containsSyntheticMedia: false,
      }),
    ).toEqual({
      selfDeclaredMadeForKids: true,
      containsSyntheticMedia: false,
    });
  });
});

describe("findMissingDisclosures", () => {
  it("reports every outstanding answer at once, not one at a time", () => {
    const missing = findMissingDisclosures(undeclared);
    expect(missing.map((entry) => entry.field).sort()).toEqual([
      "containsSyntheticMedia",
      "madeForKids",
    ]);
  });

  it("reports nothing once both are answered", () => {
    expect(findMissingDisclosures(declared)).toEqual([]);
  });

  it("names the audience question in words a creator can act on", () => {
    const [missing] = findMissingDisclosures({
      madeForKids: null,
      containsSyntheticMedia: false,
    });
    expect(missing?.message).toContain("made for kids");
  });

  it("names the synthetic-media question", () => {
    const [missing] = findMissingDisclosures({
      madeForKids: false,
      containsSyntheticMedia: null,
    });
    expect(missing?.message).toContain("synthetic");
  });
});

describe("the guidance shown beside each question", () => {
  it("leaves the synthetic-media judgement to the creator", () => {
    // This app generates the visuals, so it knows the content is synthetic. It
    // cannot know whether the result is realistic in YouTube's sense, and must
    // not imply that it does.
    expect(SYNTHETIC_MEDIA_GUIDANCE).toContain("You decide");
    expect(SYNTHETIC_MEDIA_GUIDANCE).toContain("realistic");
  });

  it("says why the audience question is being asked", () => {
    expect(MADE_FOR_KIDS_GUIDANCE).toContain("requires");
  });

  it("labels both audience answers", () => {
    expect(YOUTUBE_AUDIENCE_LABELS.made_for_kids).toContain("Yes");
    expect(YOUTUBE_AUDIENCE_LABELS.not_made_for_kids).toContain("No");
  });
});

describe("describeDisclosures", () => {
  it("says plainly when something has not been declared", () => {
    const described = describeDisclosures(undeclared);
    expect(described).toContain("not declared");
  });

  it("never reads an unanswered question as a no", () => {
    expect(describeDisclosures(undeclared)).not.toContain("Not made for kids");
  });

  it("reads back what was chosen", () => {
    const described = describeDisclosures(declared);
    expect(described).toContain("Not made for kids");
    expect(described).toContain("Disclosed as altered or synthetic");
  });
});
