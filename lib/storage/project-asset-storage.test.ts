import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "test-bucket" }),
}));

vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import {
  deleteProjectAssetObjects,
  ProjectAssetPurgeError,
} from "@/lib/storage/project-asset-storage";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const PREFIX = `workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/`;

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

describe("deleteProjectAssetObjects", () => {
  beforeEach(() => {
    mocks.send.mockReset();
  });

  it("lists and deletes everything under the project's prefix", async () => {
    respondWith([
      { keys: [`${PREFIX}renders/a.mp4`, `${PREFIX}scenes/b.webp`] },
    ]);

    const result = await deleteProjectAssetObjects({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });

    expect(result.deletedCount).toBe(2);
    const list = mocks.send.mock.calls.find(([c]) =>
      commandName(c).startsWith("ListObjectsV2"),
    )![0];
    expect(commandInput(list).Prefix).toBe(PREFIX);
    expect(commandInput(list).Bucket).toBe("test-bucket");

    const del = mocks.send.mock.calls.find(([c]) =>
      commandName(c).startsWith("DeleteObjects"),
    )![0];
    expect(commandInput(del).Delete).toMatchObject({
      Objects: [
        { Key: `${PREFIX}renders/a.mp4` },
        { Key: `${PREFIX}scenes/b.webp` },
      ],
    });
  });

  it("scopes the prefix to the project so sibling projects are untouched", async () => {
    respondWith([{ keys: [] }]);
    await deleteProjectAssetObjects({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });
    const list = mocks.send.mock.calls.find(([c]) =>
      commandName(c).startsWith("ListObjectsV2"),
    )![0];
    // Character artwork lives at workspaces/{ws}/characters/… — outside this
    // prefix — so a project delete can never take a shared character with it.
    expect(commandInput(list).Prefix).toBe(PREFIX);
    expect(commandInput(list).Prefix).toContain(`/projects/${PROJECT_ID}/`);
  });

  it("follows pagination until the listing is no longer truncated", async () => {
    respondWith([
      { keys: ["a", "b"], truncated: true },
      { keys: ["c"], truncated: false },
    ]);

    const result = await deleteProjectAssetObjects({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });

    expect(result.deletedCount).toBe(3);
    const listCalls = mocks.send.mock.calls.filter(([c]) =>
      commandName(c).startsWith("ListObjectsV2"),
    );
    expect(listCalls).toHaveLength(2);
    expect(commandInput(listCalls[1]![0]).ContinuationToken).toBe("token-1");
  });

  it("issues no delete call when the prefix is already empty", async () => {
    respondWith([{ keys: [] }]);
    const result = await deleteProjectAssetObjects({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });
    expect(result.deletedCount).toBe(0);
    expect(
      mocks.send.mock.calls.filter(([c]) =>
        commandName(c).startsWith("DeleteObjects"),
      ),
    ).toHaveLength(0);
  });

  it("throws on a partial delete failure instead of reporting success", async () => {
    // Reporting success here would let the caller delete the database rows that
    // point at the surviving objects, making the leak untraceable.
    mocks.send.mockImplementation(async (command: unknown) => {
      if (commandName(command).startsWith("ListObjectsV2"))
        return { Contents: [{ Key: "a" }, { Key: "b" }], IsTruncated: false };
      return { Errors: [{ Key: "b", Message: "AccessDenied" }] };
    });

    await expect(
      deleteProjectAssetObjects({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
      }),
    ).rejects.toBeInstanceOf(ProjectAssetPurgeError);
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

    await expect(
      deleteProjectAssetObjects({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
      }),
    ).rejects.toBeInstanceOf(ProjectAssetPurgeError);
  });
});
