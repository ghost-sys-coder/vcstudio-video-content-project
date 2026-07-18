import { afterEach, describe, expect, it } from "vitest";
import {
  getPreviewTelemetry,
  recordPreviewEvent,
  redactUrl,
  resetPreviewTelemetry,
} from "@/lib/render/preview-telemetry";

afterEach(() => {
  resetPreviewTelemetry();
});

describe("recordPreviewEvent", () => {
  it("stamps and retains events in order", () => {
    recordPreviewEvent({
      type: "load-start",
      assetType: "image",
      sceneId: "s1",
    });
    recordPreviewEvent({
      type: "decode-complete",
      assetType: "image",
      sceneId: "s1",
      currentFrame: 12,
    });
    const recorded = getPreviewTelemetry();
    expect(recorded).toHaveLength(2);
    expect(recorded[0].type).toBe("load-start");
    expect(recorded[1]).toMatchObject({
      type: "decode-complete",
      currentFrame: 12,
    });
    expect(typeof recorded[0].timestamp).toBe("number");
  });

  it("bounds the ring buffer", () => {
    for (let index = 0; index < 600; index += 1)
      recordPreviewEvent({ type: "window-updated", currentFrame: index });
    const recorded = getPreviewTelemetry();
    expect(recorded.length).toBeLessThanOrEqual(500);
    // The oldest events are dropped, so the newest frame survives.
    expect(recorded.at(-1)?.currentFrame).toBe(599);
  });
});

describe("redactUrl", () => {
  it("removes signed query credentials", () => {
    expect(redactUrl("https://cdn.test/a.webp?X-Amz-Signature=secret")).toBe(
      "https://cdn.test/a.webp?…",
    );
  });

  it("leaves unsigned urls intact", () => {
    expect(redactUrl("https://cdn.test/a.webp")).toBe(
      "https://cdn.test/a.webp",
    );
  });
});
