import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const recorded: {
  step: string;
  state: string;
  detail: string | null;
}[] = [];

vi.mock("@/db/commands/publication-finishing-commands", () => ({
  initialiseFinishingSteps: vi.fn(async () => undefined),
  recordFinishingStep: vi.fn(
    async (input: { step: string; state: string; detail: string | null }) => {
      recorded.push({
        step: input.step,
        state: input.state,
        detail: input.detail,
      });
    },
  ),
}));

const releasePackage = {
  thumbnailGenerationId: "thumb-1" as string | null,
  youtubePlaylistId: null as string | null,
};

vi.mock("@/db/repositories/release-packages.repository", () => ({
  findReleasePackage: vi.fn(async () => releasePackage),
}));

vi.mock("@/db/repositories/thumbnail-generation.repository", () => ({
  findThumbnailGeneration: vi.fn(async () => ({
    assetObjectKey: "key",
    outputFormat: "png",
    assetSizeBytes: 500_000,
  })),
}));

vi.mock("@/lib/storage/thumbnail-storage", () => ({
  createThumbnailDownloadUrl: vi.fn(async () => "https://example.com/t.png"),
}));

const { runYouTubeFinishing } =
  await import("@/lib/publishing/run-youtube-finishing");

const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const FULL_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

function provider(overrides: Record<string, unknown> = {}) {
  return {
    setThumbnail: vi.fn(async () => ({
      state: "succeeded" as const,
      detail: null,
    })),
    insertCaptions: vi.fn(async () => ({
      state: "succeeded" as const,
      detail: null,
    })),
    addToPlaylist: vi.fn(async () => ({
      state: "succeeded" as const,
      detail: null,
    })),
    ...overrides,
  };
}

function run(input: {
  grantedScopes: string[];
  provider: ReturnType<typeof provider>;
  captions?: { language: string; name: string; body: string } | null;
}) {
  return runYouTubeFinishing({
    workspaceId: "ws",
    projectId: "proj",
    publicationId: "pub",
    releasePackageId: "pkg",
    videoId: "vid",
    accessToken: "token",
    grantedScopes: input.grantedScopes,
    provider: input.provider as never,
    captions: input.captions ?? null,
  });
}

beforeEach(() => {
  recorded.length = 0;
  releasePackage.thumbnailGenerationId = "thumb-1";
  releasePackage.youtubePlaylistId = null;
});

describe("an upload-only connection", () => {
  it("still attaches the thumbnail, because that scope covers it", async () => {
    const fake = provider();
    await run({ grantedScopes: [UPLOAD_SCOPE], provider: fake });
    expect(fake.setThumbnail).toHaveBeenCalledOnce();
    expect(recorded).toContainEqual({
      step: "thumbnail",
      state: "succeeded",
      detail: null,
    });
  });

  it("marks captions unsupported without calling the provider", async () => {
    // Calling and failing would be wrong twice over: it wastes a request, and
    // it records a failure that invites a retry which cannot ever work.
    const fake = provider();
    await run({
      grantedScopes: [UPLOAD_SCOPE],
      provider: fake,
      captions: { language: "en", name: "Captions", body: "1\\n" },
    });
    expect(fake.insertCaptions).not.toHaveBeenCalled();
    const captions = recorded.find((entry) => entry.step === "captions");
    expect(captions?.state).toBe("unsupported");
    expect(captions?.detail).toContain("uploading only");
  });

  it("marks a wanted playlist unsupported rather than silently dropping it", async () => {
    releasePackage.youtubePlaylistId = "PL123";
    const fake = provider();
    await run({ grantedScopes: [UPLOAD_SCOPE], provider: fake });
    expect(fake.addToPlaylist).not.toHaveBeenCalled();
    expect(recorded.find((entry) => entry.step === "playlist")?.state).toBe(
      "unsupported",
    );
  });
});

describe("a fully permitted connection", () => {
  it("runs every step that has something to do", async () => {
    releasePackage.youtubePlaylistId = "PL123";
    const fake = provider();
    await run({
      grantedScopes: [FULL_SCOPE],
      provider: fake,
      captions: { language: "en", name: "Captions", body: "1\\n" },
    });
    expect(fake.setThumbnail).toHaveBeenCalledOnce();
    expect(fake.insertCaptions).toHaveBeenCalledOnce();
    expect(fake.addToPlaylist).toHaveBeenCalledOnce();
  });
});

describe("steps with nothing to do", () => {
  it("are recorded as skipped, not left absent", async () => {
    // An absent row is indistinguishable from a worker that never ran.
    releasePackage.thumbnailGenerationId = null;
    await run({ grantedScopes: [FULL_SCOPE], provider: provider() });
    for (const step of ["thumbnail", "captions", "playlist"])
      expect(recorded.find((entry) => entry.step === step)?.state).toBe(
        "skipped",
      );
  });
});

describe("one step failing does not take the others down", () => {
  it("records the failure and still runs the rest", async () => {
    releasePackage.youtubePlaylistId = "PL123";
    const fake = provider({
      setThumbnail: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    await run({ grantedScopes: [FULL_SCOPE], provider: fake });
    expect(recorded.find((entry) => entry.step === "thumbnail")?.state).toBe(
      "failed",
    );
    expect(fake.addToPlaylist).toHaveBeenCalledOnce();
    expect(recorded.find((entry) => entry.step === "playlist")?.state).toBe(
      "succeeded",
    );
  });

  it("never throws, because the video is already published by then", async () => {
    const fake = provider({
      setThumbnail: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(
      run({ grantedScopes: [FULL_SCOPE], provider: fake }),
    ).resolves.toBeUndefined();
  });

  it("passes a provider's own refusal through as its outcome", async () => {
    const fake = provider({
      setThumbnail: vi.fn(async () => ({
        state: "unsupported" as const,
        detail: "This channel is not permitted to set custom thumbnails.",
      })),
    });
    await run({ grantedScopes: [FULL_SCOPE], provider: fake });
    const thumbnail = recorded.find((entry) => entry.step === "thumbnail");
    expect(thumbnail?.state).toBe("unsupported");
    expect(thumbnail?.detail).toContain("not permitted");
  });
});
