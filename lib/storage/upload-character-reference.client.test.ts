import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCharacterReference } from "@/lib/storage/upload-character-reference.client";

afterEach(() => vi.unstubAllGlobals());

describe("character reference client upload", () => {
  it("authorizes, uploads, and finalizes a scoped reference in order", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectKey:
              "workspaces/workspace/characters/character/references/master/reference.png",
            uploadUrl: "https://storage.example/upload",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ referenceId: "reference" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await uploadCharacterReference({
      workspaceId: "workspace",
      characterId: "character",
      type: "master",
      file: new File(["reference"], "reference.png", { type: "image/png" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/workspaces/workspace/characters/character/references/upload",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://storage.example/upload");
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "/api/workspaces/workspace/characters/character/references/complete",
    );
  });
});
