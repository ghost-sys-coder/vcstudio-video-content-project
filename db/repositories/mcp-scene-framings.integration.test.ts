import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
vi.mock("server-only", () => ({}));
const shared = vi.hoisted(() => ({ database: undefined as unknown }));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => shared.database }));
import { listMcpSceneImageFramings } from "./mcp-content.repository";
const pg = new PGlite();
const ids = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  sceneId: "33333333-3333-4333-8333-333333333333",
  sceneVersionId: "44444444-4444-4444-8444-444444444444",
};
const other = "99999999-9999-4999-8999-999999999999";
beforeAll(async () => {
  await pg.exec(`
    create table project_output_variants (id uuid primary key, workspace_id uuid, project_id uuid, aspect_ratio text, width integer, height integer);
    create table scene_variant_framings (output_variant_id uuid, workspace_id uuid, project_id uuid, scene_id uuid, scene_version_id uuid, source_image_generation_id uuid, mode text, focal_point_x_bps integer, focal_point_y_bps integer, scale_bps integer, background_color text);
    insert into project_output_variants values
      ('55555555-5555-4555-8555-555555555555','${ids.workspaceId}','${ids.projectId}','16:9',1920,1080),
      ('66666666-6666-4666-8666-666666666666','${other}','${ids.projectId}','9:16',1080,1920);
    insert into scene_variant_framings values
      ('55555555-5555-4555-8555-555555555555','${ids.workspaceId}','${ids.projectId}','${ids.sceneId}','${ids.sceneVersionId}','77777777-7777-4777-8777-777777777777','contain',5000,5000,10000,'#000000'),
      ('66666666-6666-4666-8666-666666666666','${ids.workspaceId}','${ids.projectId}','${ids.sceneId}','${ids.sceneVersionId}','88888888-8888-4888-8888-888888888888','cover',5000,5000,10000,'#000000');
  `);
  shared.database = drizzle({ client: pg });
}, 30000);
afterAll(async () => {
  await pg.close();
});
describe("MCP saved scene framing reads against PostgreSQL", () => {
  it("returns only the current tenant's joined output and explicit safe framing fields", async () => {
    const rows = await listMcpSceneImageFramings(ids);
    expect(rows).toEqual([
      {
        outputVariantId: "55555555-5555-4555-8555-555555555555",
        aspectRatio: "16:9",
        outputWidth: 1920,
        outputHeight: 1080,
        sourceImageGenerationId: "77777777-7777-4777-8777-777777777777",
        mode: "contain",
        focalPointXBps: 5000,
        focalPointYBps: 5000,
        scaleBps: 10000,
        backgroundColor: "#000000",
      },
    ]);
  });
  it.each(["workspaceId", "projectId", "sceneId", "sceneVersionId"] as const)(
    "rejects a mismatched %s",
    async (field) => {
      expect(
        await listMcpSceneImageFramings({ ...ids, [field]: other }),
      ).toEqual([]);
    },
  );
});
