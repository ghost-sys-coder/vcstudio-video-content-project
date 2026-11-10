vi.mock("@/db/repositories/scene-visual-selections.repository", () => ({
  findSceneVisualSelection: async () => null,
}));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { mcpContextFixture, mcpIds } from "@/lib/test-utils/mcp-fixtures";
vi.mock("server-only", () => ({}));
vi.mock("@/db/repositories/mcp-generation.repository", () => ({
  listMcpSceneAudio: async () => [],
}));
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  project: vi.fn(),
  asset: vi.fn(),
  scene: vi.fn(),
  variants: vi.fn(),
  framing: vi.fn(),
  framings: vi.fn(),
  images: vi.fn(),
  save: vi.fn(),
  origin: vi.fn(),
  download: vi.fn(),
  put: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("./context", () => ({ authorizeMcp: m.authorize }));
vi.mock("./rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("./project-access", () => ({ requireMcpProject: m.project }));
vi.mock("./operations", () => ({
  mutateOnce: m.mutate,
  publicOperation: vi.fn(),
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.asset,
}));
vi.mock("@/db/repositories/scenes.repository", () => ({
  findCurrentScene: m.scene,
}));
vi.mock("@/db/repositories/output-variants.repository", () => ({
  listProjectOutputVariants: m.variants,
}));
vi.mock("@/db/commands/output-variant-commands", () => ({
  saveSceneVariantFraming: m.framing,
}));
vi.mock("@/db/commands/scene-image-commands", () => ({
  saveUploadedSceneImage: m.save,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  addMcpAssetOrigin: m.origin,
}));
vi.mock("@/db/repositories/mcp-content.repository", () => ({
  listMcpSceneImageFramings: m.framings,
}));
vi.mock("@/db/repositories/scene-images.repository", () => ({
  listSceneImageGenerationSummaries: m.images,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  downloadMediaAssetBytes: m.download,
}));
vi.mock("@/lib/storage/mcp-scene-image", () => ({ putMcpSceneImage: m.put }));
import { registerAssetTools } from "./register-asset-tools";
import { registerContentTools } from "./register-content-tools";
import { createToolRegistrar } from "./register-tool";
const ctx = mcpContextFixture();
const projectId = "88888888-8888-4888-8888-888888888888";
const sceneId = "99999999-9999-4999-8999-999999999999";
const versionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const variantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const clients: Client[] = [];
const request = {
  workspaceId: ctx.workspaceId,
  projectId,
  sceneId,
  expectedVersion: 1,
  mediaAssetId: mcpIds.asset,
  idempotencyKey: "reuse-framing-test",
};
let source: Buffer;
beforeEach(async () => {
  vi.clearAllMocks();
  source = await sharp({
    create: { width: 112, height: 140, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  m.authorize.mockResolvedValue(ctx);
  m.project.mockResolvedValue({ id: projectId, aspectRatio: "16:9" });
  m.asset.mockResolvedValue({
    id: mcpIds.asset,
    status: "ready",
    deletedAt: null,
    kind: "image",
    contentType: "image/png",
    inspectionStatus: null,
    objectKey: "library/original.png",
  });
  m.scene.mockResolvedValue({
    scene: { id: sceneId, currentVersion: 1, status: "approved" },
    version: { id: versionId },
  });
  m.variants.mockResolvedValue([
    { id: variantId, aspectRatio: "16:9", width: 1920, height: 1080 },
  ]);
  m.download.mockResolvedValue(source);
  m.put.mockResolvedValue("etag");
  m.save.mockResolvedValue({ id: mcpIds.operation });
  m.framing.mockImplementation(async (input: Record<string, unknown>) => input);
  m.framings.mockImplementation(async () =>
    m.framing.mock.calls.map(([input]) => ({
      outputVariantId: input.outputVariantId,
      aspectRatio: "16:9",
      outputWidth: 1920,
      outputHeight: 1080,
      sourceImageGenerationId: input.sourceImageGenerationId,
      mode: input.mode,
      focalPointXBps: input.focalPointXBps,
      focalPointYBps: input.focalPointYBps,
      scaleBps: input.scaleBps,
      backgroundColor: input.backgroundColor,
    })),
  );
  m.images.mockResolvedValue([
    {
      generation: {
        id: mcpIds.operation,
        size: "1536x1024",
        assetWidth: 1536,
        assetHeight: 1024,
        shotIndex: 0,
        status: "succeeded",
        reviewStatus: "pending",
        source: "user_uploaded",
      },
    },
  ]);
  m.mutate.mockImplementation(
    async (
      _ctx: unknown,
      _kind: string,
      _key: string,
      _input: unknown,
      run: (id: string) => Promise<unknown>,
    ) => ({ result: await run(mcpIds.operation) }),
  );
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});
async function connect() {
  const server = new McpServer({
    name: "reuse-framing-regression",
    version: "1",
  });
  const register = createToolRegistrar(server, ctx.principal);
  registerAssetTools(register);
  registerContentTools(register);
  const [front, back] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  clients.push(client);
  await server.connect(back);
  await client.connect(front);
  return client;
}
describe("MCP image reuse and read-back through the SDK", () => {
  it("persists contain and distinguishes the image canvas from final output, without approving or altering the original", async () => {
    const client = await connect();
    const original = Buffer.from(source);
    const assigned = await client.callTool({
      name: "assign_scene_image",
      arguments: request,
    });
    expect(assigned.isError).not.toBe(true);
    expect(assigned.structuredContent).toMatchObject({
      data: {
        result: {
          generationId: mcpIds.operation,
          sourceMediaAssetId: mcpIds.asset,
          reviewStatus: "pending",
          importFit: "contain",
          image: { size: "1536x1024", width: 1536, height: 1024 },
          outputFraming: {
            sourceImageGenerationId: mcpIds.operation,
            mode: "contain",
            scaleBps: 10000,
            outputWidth: 1920,
            outputHeight: 1080,
          },
        },
      },
    });
    expect(m.save).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: mcpIds.operation,
        workspaceId: ctx.workspaceId,
        projectId,
        sceneVersionId: versionId,
        width: 1536,
        height: 1024,
      }),
    );
    expect(m.origin).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaAssetId: mcpIds.asset,
        sceneImageId: mcpIds.operation,
      }),
    );
    expect(m.put.mock.calls[0][0]).not.toBe("library/original.png");
    expect(source).toEqual(original);
    const read = await client.callTool({
      name: "get_scene",
      arguments: { workspaceId: ctx.workspaceId, projectId, sceneId },
    });
    expect(read.structuredContent).toMatchObject({
      data: {
        images: [
          {
            id: mcpIds.operation,
            width: 1536,
            height: 1024,
            reviewStatus: "pending",
          },
        ],
        imageFramings: [
          {
            sourceImageGenerationId: mcpIds.operation,
            mode: "contain",
            outputWidth: 1920,
            outputHeight: 1080,
          },
        ],
      },
    });
    expect(m.framings).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: ctx.workspaceId,
        projectId,
        sceneId,
        sceneVersionId: versionId,
      }),
    );
    expect(JSON.stringify(read.structuredContent)).not.toContain("objectKey");
  });
  it("reports explicit cover cropping separately from contain display of the cropped derivative", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "assign_scene_image",
      arguments: { ...request, fit: "cover" },
    });
    expect(result.structuredContent).toMatchObject({
      data: {
        result: { importFit: "cover", outputFraming: { mode: "contain" } },
      },
    });
  });
  it.each(["pending", "failed"])(
    "rejects a %s library image before copying",
    async (status) => {
      m.asset.mockResolvedValue({
        status,
        kind: "image",
        contentType: "image/png",
      });
      const client = await connect();
      expect(
        (
          await client.callTool({
            name: "assign_scene_image",
            arguments: request,
          })
        ).isError,
      ).toBe(true);
      expect(m.put).not.toHaveBeenCalled();
    },
  );
  it("rejects stale scene revisions and missing output formats before writing media", async () => {
    const client = await connect();
    expect(
      (
        await client.callTool({
          name: "assign_scene_image",
          arguments: { ...request, expectedVersion: 2 },
        })
      ).isError,
    ).toBe(true);
    m.variants.mockResolvedValue([]);
    expect(
      (
        await client.callTool({
          name: "assign_scene_image",
          arguments: request,
        })
      ).isError,
    ).toBe(true);
    expect(m.put).not.toHaveBeenCalled();
  });
});
