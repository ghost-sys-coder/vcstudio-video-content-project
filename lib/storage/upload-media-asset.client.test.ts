import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  uploadMediaAsset,
  type MediaUploadProgress,
} from "./upload-media-asset.client";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

const duration = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/read-video-duration.client", () => ({
  readVideoDurationMilliseconds: duration,
}));

class StorageRequest extends EventTarget {
  static instances: StorageRequest[] = [];
  upload = new EventTarget();
  status = 0;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() {
    super();
    StorageRequest.instances.push(this);
  }
  progress(loaded: number) {
    this.upload.dispatchEvent(Object.assign(new Event("progress"), { loaded }));
  }
  finish(status = 200) {
    this.status = status;
    this.dispatchEvent(new Event("load"));
  }
}

const asset: MediaAssetView = {
  id: "asset",
  kind: "video",
  title: "Video",
  altText: "",
  tags: [],
  contentType: "video/mp4",
  sizeBytes: 1000,
  width: null,
  height: null,
  durationMilliseconds: 1000,
  originalFileName: "video.mp4",
  createdAt: "2026-11-10T00:00:00Z",
  previewUrl: "",
  inspectionPending: true,
};
const file = () =>
  new File([new Uint8Array(1000)], "video.mp4", { type: "video/mp4" });
const authorization = () =>
  Response.json({
    mediaAssetId: "asset",
    objectKey: "private/asset.mp4",
    uploadUrl: "https://storage.example/private-signed-upload",
  });

beforeEach(() => {
  StorageRequest.instances = [];
  duration.mockReset().mockResolvedValue(1000);
  vi.stubGlobal("XMLHttpRequest", StorageRequest);
});
afterEach(() => vi.unstubAllGlobals());

describe("library upload progress and completion", () => {
  it("reports actual bytes, then waits for finalization before returning an inspected/pending asset", async () => {
    let finishCompletion: (response: Response) => void = () => {
      throw new Error("completion not started");
    };
    const completion = new Promise<Response>((resolve) => {
      finishCompletion = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(authorization())
      .mockReturnValueOnce(completion);
    vi.stubGlobal("fetch", fetchMock);
    const progress: MediaUploadProgress[] = [];
    const source = file();
    let resolved = false;
    const result = uploadMediaAsset({
      workspaceId: "workspace",
      file: source,
      onProgress: (p) => progress.push(p),
    }).then((value) => {
      resolved = true;
      return value;
    });
    await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
    const request = StorageRequest.instances[0];
    expect(request.open).toHaveBeenCalledWith(
      "PUT",
      "https://storage.example/private-signed-upload",
    );
    expect(request.setRequestHeader).toHaveBeenCalledWith(
      "content-type",
      "video/mp4",
    );
    expect(request.send).toHaveBeenCalledWith(source);
    request.progress(250);
    request.progress(800);
    expect(progress).toEqual([
      { phase: "preparing", uploadedBytes: 0, totalBytes: 1000 },
      { phase: "uploading", uploadedBytes: 0, totalBytes: 1000 },
      { phase: "uploading", uploadedBytes: 250, totalBytes: 1000 },
      { phase: "uploading", uploadedBytes: 800, totalBytes: 1000 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    request.finish();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(progress.at(-1)).toEqual({
      phase: "finalizing",
      uploadedBytes: 1000,
      totalBytes: 1000,
    });
    expect(resolved).toBe(false);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/workspaces/workspace/media/complete",
    );
    finishCompletion(
      Response.json({ asset, inspectionPending: true }, { status: 202 }),
    );
    await expect(result).resolves.toEqual(asset);
  });

  it("keeps progress bounded and monotonic using the actual File size", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(authorization())
        .mockResolvedValueOnce(Response.json({ asset })),
    );
    const progress: MediaUploadProgress[] = [];
    const result = uploadMediaAsset({
      workspaceId: "workspace",
      file: file(),
      onProgress: (p) => progress.push(p),
    });
    await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
    const request = StorageRequest.instances[0];
    [500, 200, -10, NaN, 1200].forEach((loaded) => request.progress(loaded));
    expect(
      progress
        .filter((p) => p.phase === "uploading")
        .map((p) => p.uploadedBytes),
    ).toEqual([0, 500, 500, 500, 1000]);
    request.finish();
    await result;
  });

  for (const status of [403, 503]) {
    it(`does not finalize or claim success after storage HTTP ${status}`, async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(authorization());
      vi.stubGlobal("fetch", fetchMock);
      const result = uploadMediaAsset({
        workspaceId: "workspace",
        file: file(),
      });
      const rejected = expect(result).rejects.toThrow(`HTTP ${status}`);
      await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
      StorageRequest.instances[0].finish(status);
      await rejected;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  }

  for (const [event, message] of [
    ["error", "Check your connection"],
    ["abort", "interrupted"],
  ]) {
    it(`exposes an actionable ${event} and does not finalize`, async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(authorization());
      vi.stubGlobal("fetch", fetchMock);
      const result = uploadMediaAsset({
        workspaceId: "workspace",
        file: file(),
      });
      const rejected = expect(result).rejects.toThrow(message);
      await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
      StorageRequest.instances[0].dispatchEvent(new Event(event));
      await rejected;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  }

  it("does not send bytes when authorization fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: "You cannot upload media to this workspace." },
            { status: 403 },
          ),
        ),
    );
    await expect(
      uploadMediaAsset({ workspaceId: "workspace", file: file() }),
    ).rejects.toThrow("cannot upload");
    expect(StorageRequest.instances).toHaveLength(0);
  });

  it("rejects failed finalization even when every byte was transferred", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(authorization())
        .mockResolvedValueOnce(
          Response.json(
            { error: "The uploaded file is invalid." },
            { status: 400 },
          ),
        ),
    );
    const result = uploadMediaAsset({ workspaceId: "workspace", file: file() });
    const rejected = expect(result).rejects.toThrow("uploaded file is invalid");
    await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
    StorageRequest.instances[0].finish();
    await rejected;
  });

  it("retains image upload behavior without a progress callback or video metadata read", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(authorization())
        .mockResolvedValueOnce(
          Response.json({
            asset: { ...asset, kind: "image", inspectionPending: false },
          }),
        ),
    );
    const result = uploadMediaAsset({
      workspaceId: "workspace",
      file: new File(["image"], "image.png", { type: "image/png" }),
    });
    await vi.waitFor(() => expect(StorageRequest.instances).toHaveLength(1));
    StorageRequest.instances[0].finish();
    await expect(result).resolves.toMatchObject({
      kind: "image",
      inspectionPending: false,
    });
    expect(duration).not.toHaveBeenCalled();
  });
});
