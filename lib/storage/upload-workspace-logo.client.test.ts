import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadWorkspaceLogo } from "@/lib/storage/upload-workspace-logo.client";

afterEach(() => vi.unstubAllGlobals());

describe("workspace logo client upload", () => {
  it("authorizes, uploads, and finalizes in order", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectKey: "workspaces/workspace/branding/logos/logo.png",
            uploadUrl: "https://storage.example/upload",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadWorkspaceLogo({
      workspaceId: "workspace",
      file: new File(["logo"], "logo.png", { type: "image/png" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/workspaces/workspace/logo/upload",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://storage.example/upload");
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "/api/workspaces/workspace/logo/complete",
    );
  });
});
