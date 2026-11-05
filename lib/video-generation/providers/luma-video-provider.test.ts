import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LumaVideoProvider } from "./luma-video-provider";
import { findVideoModel, findVideoPricing } from "../video-model-catalog";
import { defaultVideoRequest } from "../video-composer-options";
import { planVideoGeneration } from "../plan-video-generation";
import { measuredVideoCost } from "../video-cost";
const model = findVideoModel("luma-ray-3.2")!,
  pricing = findVideoPricing(model.id)!;
const jobId = "11111111-1111-4111-8111-111111111111";
const json = (value: unknown) => new Response(JSON.stringify(value));
describe("Luma Ray 3.2 direct API", () => {
  it("sends SDR controls and inline first/last frames on the fixed authenticated endpoint", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ id: jobId, state: "queued" }));
    const provider = new LumaVideoProvider("secret", fetcher);
    await expect(
      provider.start({
        model,
        request: {
          ...defaultVideoRequest(model),
          mode: "image_to_video",
          prompt: "A misty forest.",
        },
        finalPrompt: "A misty forest.",
        assets: [
          {
            role: "last_frame",
            bytes: Buffer.from("last"),
            contentType: "image/png",
          },
          {
            role: "first_frame",
            bytes: Buffer.from("first"),
            contentType: "image/png",
          },
        ],
      }),
    ).resolves.toMatchObject({ status: "running", jobId });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://agents.lumalabs.ai/v1/generations");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "ray-3.2",
      type: "video",
      prompt: "A misty forest.",
      aspect_ratio: "16:9",
      video: {
        resolution: "360p",
        duration: "5s",
        start_frame: {
          data: Buffer.from("first").toString("base64"),
          media_type: "image/png",
        },
        end_frame: {
          data: Buffer.from("last").toString("base64"),
          media_type: "image/png",
        },
      },
    });
  });
  it("keeps 10-second pricing nonlinear and rejects 10-second anchor requests", () => {
    const request = {
      ...defaultVideoRequest(model),
      prompt: "A misty forest.",
    };
    expect(
      planVideoGeneration({ model, pricing, request }).estimatedCostCents,
    ).toBe(6);
    expect(
      planVideoGeneration({
        model,
        pricing,
        request: { ...request, durationSeconds: 10 },
      }).estimatedCostCents,
    ).toBe(18);
    expect(() =>
      planVideoGeneration({
        model,
        pricing,
        request: {
          ...request,
          mode: "image_to_video",
          durationSeconds: 10,
          inputs: [{ assetId: jobId, role: "first_frame" }],
        },
      }),
    ).toThrow("duration");
  });
  it.each([20, 0, null])(
    "records settled credits %s independently from successful media",
    async (credits) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        json({
          id: jobId,
          state: "completed",
          output: [
            {
              type: "video",
              url: "https://cdn.example/clip.mp4?token=private",
            },
          ],
          usage: { credits_charged: credits },
        }),
      );
      const state = await new LumaVideoProvider("secret", fetcher).check(jobId);
      expect(state.status).toBe("succeeded");
      if (state.status !== "succeeded")
        throw new Error("Expected completed video");
      expect(measuredVideoCost(pricing, state.usage)).toBe(
        credits === null ? null : Math.ceil(credits * 0.3),
      );
      expect(fetcher.mock.calls[0]![0]).toBe(
        `https://agents.lumalabs.ai/v1/generations/${jobId}`,
      );
    },
  );
  it("never treats a failed or malformed response as usable media", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          id: jobId,
          state: "failed",
          failure_reason: "sensitive provider detail",
        }),
      )
      .mockResolvedValueOnce(
        json({ id: jobId, state: "completed", output: [] }),
      );
    expect(
      await new LumaVideoProvider("key", fetcher).check(jobId),
    ).toMatchObject({ status: "failed", code: "luma_generation_failed" });
    await expect(
      new LumaVideoProvider("key", fetcher).check(jobId),
    ).rejects.toMatchObject({ code: "provider_missing_video" });
  });
});
