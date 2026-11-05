import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GoogleVideoProvider } from "./google-video-provider";
import { RunwayVideoProvider } from "./runway-video-provider";
import { VIDEO_MODELS } from "../video-model-catalog";
import { defaultVideoRequest } from "../video-composer-options";
import { VideoProviderError } from "../video-provider";
function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}
describe("documented Google video protocol", () => {
  const model = VIDEO_MODELS[0]!;
  const request = {
    ...defaultVideoRequest(model),
    prompt: "A calm ocean at sunset.",
  };
  it("uses Interactions background jobs, explicit video mode and header credentials", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ id: "v1_job", status: "in_progress" }));
    const provider = new GoogleVideoProvider("private-key", fetcher);
    expect(
      await provider.start({
        model,
        request,
        finalPrompt: request.prompt,
        assets: [],
      }),
    ).toMatchObject({ status: "running", jobId: "v1_job" });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(options).toMatchObject({
      headers: { "x-goog-api-key": "private-key" },
      redirect: "error",
    });
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: "gemini-omni-1.1-flash",
      background: true,
      store: true,
      stream: false,
      generation_config: { video_config: { task: "text_to_video" } },
      response_format: {
        type: "video",
        delivery: "uri",
        resolution: "360p",
        aspect_ratio: "16:9",
      },
    });
    expect(String(options?.body)).not.toContain("duration_seconds");
    expect(String(url)).not.toContain("private-key");
  });
  it("reads REST steps and measured usage, not the SDK-only output_video helper", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        id: "v1_job",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "video",
                mime_type: "video/mp4",
                data: Buffer.from("video-bytes").toString("base64"),
              },
            ],
          },
        ],
        usage: {
          total_input_tokens: 100,
          total_output_tokens: 2000,
          total_thought_tokens: 40,
          output_tokens_by_modality: [{ modality: "video", tokens: 1900 }],
        },
      }),
    );
    const result = await new GoogleVideoProvider("key", fetcher).check(
      "v1_job",
    );
    expect(result).toMatchObject({
      status: "succeeded",
      output: { kind: "inline", bytes: Buffer.from("video-bytes") },
      usage: {
        inputTokens: 100,
        outputTokens: 2000,
        videoTokens: 1900,
        thoughtTokens: 40,
      },
    });
  });
  it("rejects untrusted download origins before sending credentials", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new GoogleVideoProvider("secret", fetcher);
    for (const uri of [
      "https://evil.example/files/id",
      "http://generativelanguage.googleapis.com/v1beta/files/id",
      "https://generativelanguage.googleapis.com.evil.example/v1beta/files/id",
      "https://generativelanguage.googleapis.com:8443/v1beta/files/id",
    ]) {
      await expect(provider.download(uri)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("drops supplied download credentials and waits for actual file readiness", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ state: "PROCESSING" }));
    const provider = new GoogleVideoProvider("real-key", fetcher);
    await expect(
      provider.download(
        "https://generativelanguage.googleapis.com/v1beta/files/file123:download?key=injected",
      ),
    ).rejects.toMatchObject({ code: "google_file_pending" });
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://generativelanguage.googleapis.com/v1beta/files/file123",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("treats timeouts as ambiguous and authentication rejection as unbilled", async () => {
    const timeout = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network with secret"));
    await expect(
      new GoogleVideoProvider("key", timeout).start({
        model,
        request,
        finalPrompt: request.prompt,
        assets: [],
      }),
    ).rejects.toMatchObject({
      code: "provider_connection_uncertain",
      definitelyUnbilled: false,
    });
    const rejected = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private provider details", { status: 403 }),
      );
    await expect(
      new GoogleVideoProvider("key", rejected).start({
        model,
        request,
        finalPrompt: request.prompt,
        assets: [],
      }),
    ).rejects.toMatchObject({
      code: "provider_http_403",
      definitelyUnbilled: true,
    });
  });
});
describe("Runway native model protocol", () => {
  const model = VIDEO_MODELS[1]!;
  const request = {
    ...defaultVideoRequest(model),
    prompt: "A bicycle crossing a quiet street.",
  };
  it("uses the correct text and image endpoints and native controls", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ id: "task-1" }));
    const provider = new RunwayVideoProvider("key", fetcher);
    await provider.start({
      model,
      request,
      finalPrompt: request.prompt,
      assets: [],
    });
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://api.dev.runwayml.com/v1/text_to_video",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
      model: "gen4.5",
      duration: 5,
      ratio: "1280:720",
    });
    await provider.start({
      model,
      request: { ...request, mode: "image_to_video", seed: 0 },
      finalPrompt: request.prompt,
      assets: [
        {
          role: "first_frame",
          contentType: "image/png",
          bytes: Buffer.from("image"),
        },
      ],
    });
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://api.dev.runwayml.com/v1/image_to_video",
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toMatchObject({
      seed: 0,
      promptImage: "data:image/png;base64,aW1hZ2U=",
    });
    expect(fetcher.mock.calls[1]![1]?.headers).toMatchObject({
      "X-Runway-Version": "2024-11-06",
    });
  });
  it("supports empty successful cancellation responses without parsing JSON", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await new RunwayVideoProvider("key", fetcher).cancel("task-id");
    expect(fetcher.mock.calls[0]![1]?.method).toBe("DELETE");
  });
  it("does not surface raw provider errors or pretend an ambiguous rejection is free", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("secret error", { status: 400 }));
    const failure = await new RunwayVideoProvider("key", fetcher)
      .check("task-id")
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(VideoProviderError);
    expect(failure).toMatchObject({ definitelyUnbilled: false });
    expect(String(failure)).not.toContain("secret error");
  });
});
