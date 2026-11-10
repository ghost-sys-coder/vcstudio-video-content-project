import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ context: vi.fn(), voices: vi.fn() }));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: m.context,
}));
vi.mock("@/lib/elevenlabs/voices", () => ({ listElevenLabsVoices: m.voices }));
vi.mock("@/lib/elevenlabs/configuration", async (original) => ({
  ...(await original<typeof import("@/lib/elevenlabs/configuration")>()),
  elevenLabsStatus: () => ({ voice: { model: "eleven_multilingual_v2" } }),
}));
import { GET } from "./route";
import { ElevenLabsUnavailableError } from "@/lib/elevenlabs/errors";
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({ activeMembership: { role: "owner" } });
  m.voices.mockResolvedValue({
    voices: [{ id: "ownedVoice1234567890", name: "Frank’s Voice" }],
    nextCursor: null,
  });
});
describe("private account voice discovery route", () => {
  it("does not contact ElevenLabs without an authenticated workspace", async () => {
    m.context.mockResolvedValue(null);
    expect(
      (await GET(new Request("https://vcstudio.example/api/elevenlabs/voices")))
        .status,
    ).toBe(401);
    expect(m.voices).not.toHaveBeenCalled();
  });
  it("denies viewers before reading the provider account", async () => {
    m.context.mockResolvedValue({ activeMembership: { role: "viewer" } });
    expect(
      (await GET(new Request("https://vcstudio.example/api/elevenlabs/voices")))
        .status,
    ).toBe(403);
    expect(m.voices).not.toHaveBeenCalled();
  });
  it("returns only the bounded voice page and model for authorized owners", async () => {
    const response = await GET(
      new Request(
        "https://vcstudio.example/api/elevenlabs/voices?cursor=next-page",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(m.voices).toHaveBeenCalledWith("next-page");
    expect(await response.json()).toEqual({
      voices: [{ id: "ownedVoice1234567890", name: "Frank’s Voice" }],
      nextCursor: null,
      model: "eleven_multilingual_v2",
    });
  });
  it("reports a disabled service without exposing credentials or raw responses", async () => {
    m.voices.mockRejectedValue(
      new ElevenLabsUnavailableError(
        "ElevenLabs is switched off on this deployment.",
      ),
    );
    const response = await GET(
      new Request("https://vcstudio.example/api/elevenlabs/voices"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "ElevenLabs is switched off on this deployment.",
    });
  });
});
