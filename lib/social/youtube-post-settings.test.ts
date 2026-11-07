import { describe, expect, it } from "vitest";
import { socialYouTubeSettingsSchema } from "@studio/contracts/publishing";
import {
  resolveYouTubePostSettings,
  youTubeSettingsProblem,
  youTubeThumbnailProblem,
} from "./youtube-post-settings";
describe("shared YouTube upload settings", () => {
  it("reports invalid in-progress form values without throwing during rendering", () => {
    const settings = socialYouTubeSettingsSchema.parse({
      madeForKids: false,
      containsSyntheticMedia: false,
    });
    expect(() =>
      youTubeSettingsProblem({ ...settings, tags: ["x".repeat(81)] }, "Post"),
    ).not.toThrow();
    expect(
      youTubeSettingsProblem({ ...settings, tags: ["x".repeat(81)] }, "Post"),
    ).not.toBeNull();
  });
  it("preserves unanswered declarations and uses the post only for unset text fields", () => {
    expect(
      resolveYouTubePostSettings(null, "First line\nSecond line"),
    ).toMatchObject({
      title: "First line",
      description: "First line\nSecond line",
      madeForKids: null,
      containsSyntheticMedia: null,
    });
    expect(youTubeSettingsProblem(null, "Post")).toContain("made for kids");
    const value = socialYouTubeSettingsSchema.parse({
      madeForKids: false,
      containsSyntheticMedia: false,
      description: "",
    });
    expect(youTubeSettingsProblem(value, "Post")).toBeNull();
    expect(resolveYouTubePostSettings(value, "Post").description).toBe("");
  });
  it("normalizes comma-separated tags and enforces YouTube's quoted tag budget", () => {
    expect(
      socialYouTubeSettingsSchema.parse({ tags: [" one ", "two"] }).tags,
    ).toEqual(["one", "two"]);
    expect(
      socialYouTubeSettingsSchema.safeParse({
        tags: Array.from({ length: 10 }, () => "long tag ".repeat(7)),
      }).success,
    ).toBe(false);
  });
  it("accepts decoded PNG/JPEG thumbnails only and keeps them separate from video media", () => {
    const asset = {
      kind: "image",
      contentType: "image/png",
      width: 1080,
      height: 1920,
      sizeBytes: 3_000_000,
    };
    expect(youTubeThumbnailProblem(asset)).toBeNull();
    expect(
      youTubeThumbnailProblem({ ...asset, contentType: "image/webp" }),
    ).toContain("JPEG or PNG");
    expect(youTubeThumbnailProblem({ ...asset, width: null })).toContain(
      "decoded",
    );
    expect(
      youTubeThumbnailProblem({ ...asset, sizeBytes: 51 * 1024 * 1024 }),
    ).toContain("50 MB");
  });
});
