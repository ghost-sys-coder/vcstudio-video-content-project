import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { startElevenLabsMedia, getElevenLabsMedia } from "./client";
const fetcher = vi.fn();
beforeEach(() => {
  for (const [key, value] of Object.entries({
    ENABLE_ELEVENLABS: "true",
    ELEVEN_LABS_API_KEY: "fake-private-key",
    ELEVENLABS_INTERNAL_DEPLOYMENT: "true",
    ENABLE_PRIVATE_ACCESS: "true",
    ELEVENLABS_VISUALS_ENABLED: "true",
  }))
    vi.stubEnv(key, value);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("ElevenLabs visual API preflight", () => {
  it("rejects Creator before submitting a billable image or video", async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ tier: "creator", status: "active" })),
    );
    await expect(
      startElevenLabsMedia("video", { prompt: "test" }),
    ).rejects.toThrow(/Pro/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("/user/subscription");
  });
  it("requires active Pro and posts exactly once with redirects disabled", async () => {
    fetcher
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tier: "pro", status: "active" })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "remote-job-1", status: "pending" })),
      );
    expect(
      await startElevenLabsMedia("image", {
        model_id: "gpt-image-1.5",
        prompt: "test",
      }),
    ).toEqual({ id: "remote-job-1", status: "pending" });
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { "xi-api-key": "fake-private-key" },
    });
  });
  it("does not contact the API after the master switch is off", async () => {
    vi.stubEnv("ENABLE_ELEVENLABS", "false");
    await expect(getElevenLabsMedia("image", "job")).rejects.toThrow(
      /switched off/,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects tampered handles and mismatched API response IDs", async () => {
    await expect(getElevenLabsMedia("image", "../../secret")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ id: "wrong", status: "pending" })),
    );
    await expect(getElevenLabsMedia("image", "original")).rejects.toThrow();
  });
  it("returns safe subscription failures without raw bodies or credentials", async () => {
    fetcher.mockResolvedValue(
      new Response("secret provider body", { status: 402 }),
    );
    await expect(getElevenLabsMedia("image", "job")).rejects.toThrow(
      "ElevenLabs image/video API access requires Pro or higher.",
    );
  });
});
