import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "test-bucket" }),
}));

vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import { deleteSceneAssetObjects } from "@/lib/storage/scene-asset-storage";
import { StoragePurgeError } from "@/lib/storage/purge-object-prefix";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const SCENE_ID = "33333333-3333-4333-8333-333333333333";
const SCENE = {
  workspaceId: WORKSPACE_ID,
  projectId: PROJECT_ID,
  sceneId: SCENE_ID,
};
const PREFIX = `workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/scenes/${SCENE_ID}/`;

function commandName(command: unknown): string {
  return command?.constructor?.name ?? "";
}

function commandInput(command: unknown): Record<string, unknown> {
  return (
    (typeof command === "object" && command !== null
      ? (Reflect.get(command, "input") as Record<string, unknown>)
      : {}) ?? {}
  );
}

/** Queues list responses, then answers deletes with an empty error list. */
function respondWith(pages: { keys: string[]; truncated?: boolean }[]): void {
  let pageIndex = 0;
  mocks.send.mockImplementation(async (command: unknown) => {
    if (commandName(command).startsWith("ListObjectsV2")) {
      const page = pages[pageIndex++] ?? { keys: [] };
      return {
        Contents: page.keys.map((Key) => ({ Key })),
        IsTruncated: page.truncated ?? false,
        NextContinuationToken: page.truncated
          ? `token-${pageIndex}`
          : undefined,
      };
    }
    return { Errors: [] };
  });
}

describe("deleteSceneAssetObjects", () => {
  beforeEach(() => {
    mocks.send.mockReset();
  });

  it("deletes the scene's images, clips and narration audio", async () => {
    respondWith([
      {
        keys: [
          `${PREFIX}versions/v1/images/a.webp`,
          `${PREFIX}versions/v1/clips/b.mp4`,
          `${PREFIX}audio/c.mp3`,
        ],
      },
    ]);

    const result = await deleteSceneAssetObjects(SCENE);

    expect(result.deletedCount).toBe(3);
    const deleteCall = mocks.send.mock.calls.find(([command]) =>
      commandName(command).startsWith("DeleteObjects"),
    );
    expect(commandInput(deleteCall![0])).toMatchObject({
      Bucket: "test-bucket",
      Delete: {
        Objects: [
          { Key: `${PREFIX}versions/v1/images/a.webp` },
          { Key: `${PREFIX}versions/v1/clips/b.mp4` },
          { Key: `${PREFIX}audio/c.mp3` },
        ],
      },
    });
  });

  it("looks only under this scene, so a sibling scene keeps its work", async () => {
    respondWith([{ keys: [] }]);
    await deleteSceneAssetObjects(SCENE);
    const listCall = mocks.send.mock.calls.find(([command]) =>
      commandName(command).startsWith("ListObjectsV2"),
    );
    expect(commandInput(listCall![0]).Prefix).toBe(PREFIX);
  });

  it("issues no delete call when the scene generated nothing", async () => {
    respondWith([{ keys: [] }]);
    const result = await deleteSceneAssetObjects(SCENE);
    expect(result.deletedCount).toBe(0);
    expect(
      mocks.send.mock.calls.filter(([command]) =>
        commandName(command).startsWith("DeleteObjects"),
      ),
    ).toHaveLength(0);
  });

  it("throws on a partial delete failure instead of reporting success", async () => {
    // Reporting success here would let the caller delete the scene rows that
    // point at the surviving objects, making the leak untraceable.
    mocks.send.mockImplementation(async (command: unknown) => {
      if (commandName(command).startsWith("ListObjectsV2"))
        return { Contents: [{ Key: "a" }, { Key: "b" }], IsTruncated: false };
      return { Errors: [{ Key: "b", Message: "AccessDenied" }] };
    });

    await expect(deleteSceneAssetObjects(SCENE)).rejects.toBeInstanceOf(
      StoragePurgeError,
    );
  });

  it("stops rather than paginating forever on an unbounded prefix", async () => {
    mocks.send.mockImplementation(async (command: unknown) => {
      if (commandName(command).startsWith("ListObjectsV2"))
        return {
          Contents: [{ Key: "x" }],
          IsTruncated: true,
          NextContinuationToken: "next",
        };
      return { Errors: [] };
    });

    await expect(deleteSceneAssetObjects(SCENE)).rejects.toBeInstanceOf(
      StoragePurgeError,
    );
  });
});
