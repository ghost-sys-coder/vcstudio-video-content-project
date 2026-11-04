import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LookupAddress, LookupOptions } from "node:dns";
const m = vi.hoisted(() => ({
  request: vi.fn(),
  lookup: vi.fn(),
  close: vi.fn(),
  options: undefined as unknown,
}));
vi.mock("node:dns", () => ({ lookup: m.lookup }));
vi.mock("undici", () => ({
  request: m.request,
  Agent: class {
    constructor(options: unknown) {
      m.options = options;
    }
    close = m.close;
  },
}));
import { withPublicDownload } from "./safe-download";
import { z } from "zod";
function response(statusCode: number, headers: Record<string, string> = {}) {
  return { statusCode, headers, body: { destroy: vi.fn() } };
}
beforeEach(() => {
  vi.clearAllMocks();
});
describe("download transport safeguards", () => {
  it("rejects redirects to internal services before making the second request", async () => {
    m.request.mockResolvedValue(
      response(302, { location: "https://127.0.0.1/secret" }),
    );
    await expect(
      withPublicDownload("https://files.example/image", async () => null),
    ).rejects.toThrow("public HTTPS");
    expect(m.request).toHaveBeenCalledTimes(1);
    expect(m.close).toHaveBeenCalled();
  });
  it("rejects expired downloads without forwarding credential-bearing URLs in errors", async () => {
    m.request.mockResolvedValue(response(403));
    await expect(
      withPublicDownload(
        "https://files.example/image?token=private",
        async () => null,
      ),
    ).rejects.toThrow("unavailable or expired");
  });
  it("pins public DNS results in the actual connector and rejects mixed/private DNS answers", async () => {
    m.request.mockResolvedValue(response(200, { "content-type": "image/png" }));
    await withPublicDownload("https://files.example/image", async () => null);
    const options = z
      .object({
        connect: z.object({
          lookup: z.custom<
            (
              host: string,
              options: LookupOptions,
              callback: (
                error: Error | null,
                address: string | LookupAddress[],
                family?: number,
              ) => void,
            ) => void
          >((v) => typeof v === "function"),
        }),
      })
      .parse(m.options);
    m.lookup.mockImplementation((_host, _options, callback) =>
      callback(null, [{ address: "8.8.8.8", family: 4 }]),
    );
    const callback = vi.fn();
    options.connect.lookup("files.example", {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, "8.8.8.8", 4);
    m.lookup.mockImplementation((_host, _options, cb) =>
      cb(null, [
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ]),
    );
    options.connect.lookup("files.example", {}, callback);
    expect(callback.mock.lastCall?.[0]).toBeInstanceOf(Error);
  });
});
