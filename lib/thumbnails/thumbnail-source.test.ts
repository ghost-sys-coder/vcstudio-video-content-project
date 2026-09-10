import { describe, expect, it } from "vitest";
import {
  describeThumbnailGenerationRequest,
  describeThumbnailOrigin,
} from "@/lib/thumbnails/thumbnail-source";

const generated = {
  source: "ai_generated" as const,
  textMode: "clean" as const,
  finalPrompt: "A clear face against high contrast.",
  requestFingerprint: "fingerprint",
  model: "gpt-image-1",
  quality: "high" as const,
  outputCompression: 80,
  headlineText: null,
};

const uploaded = {
  source: "user_uploaded" as const,
  textMode: null,
  finalPrompt: null,
  requestFingerprint: null,
  model: null,
  quality: null,
  outputCompression: null,
  headlineText: null,
};

describe("describeThumbnailGenerationRequest", () => {
  it("returns the provider parameters of a real generation", () => {
    expect(describeThumbnailGenerationRequest(generated)).toEqual({
      textMode: "clean",
      finalPrompt: generated.finalPrompt,
      requestFingerprint: "fingerprint",
      model: "gpt-image-1",
      quality: "high",
      outputCompression: 80,
    });
  });

  it("refuses an upload, which was never generated from anything", () => {
    // The guard that matters: an upload reaching the generation worker would
    // otherwise be sent to a paid provider with invented parameters.
    expect(describeThumbnailGenerationRequest(uploaded)).toBeNull();
  });

  it("refuses a half-filled row rather than guessing the rest", () => {
    // A database constraint enforces all-or-nothing, so a partial row means
    // something bypassed it and must not be trusted.
    for (const field of [
      "textMode",
      "finalPrompt",
      "requestFingerprint",
      "model",
      "quality",
      "outputCompression",
    ] as const)
      expect(
        describeThumbnailGenerationRequest({ ...generated, [field]: null }),
      ).toBeNull();
  });
});

describe("describeThumbnailOrigin", () => {
  it("says an uploaded image was uploaded, and claims nothing about its text", () => {
    // The creator's own file may well contain text. Calling it "text-free"
    // would be an unchecked claim about what is inside it.
    const label = describeThumbnailOrigin(uploaded);
    expect(label).toBe("Uploaded");
    expect(label).not.toContain("Text-free");
  });

  it("keeps describing a generation by what was asked for", () => {
    expect(describeThumbnailOrigin(generated)).toBe("Text-free");
    expect(
      describeThumbnailOrigin({
        ...generated,
        textMode: "baked",
        headlineText: "Seven days",
      }),
    ).toBe("Headline baked in");
  });

  it("never describes an upload by a text mode, even a stored one", () => {
    // Defence in depth: if a text mode ever survived on an uploaded row, the
    // gallery still must not repeat it as fact.
    expect(
      describeThumbnailOrigin({
        source: "user_uploaded",
        textMode: "baked",
        headlineText: "Left over",
      }),
    ).toBe("Uploaded");
  });
});
