import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifiedVideoMetadataSchema } from "@/lib/media/media-inspection";
vi.mock("server-only", () => ({}));
const pg = new PGlite(),
  database = drizzle({ client: pg });
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import { saveMediaAssetThumbnail } from "@/db/commands/media-inspection-commands";
const workspace = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const metadata = verifiedVideoMetadataSchema.parse({
  kind: "video",
  durationMilliseconds: 8000,
  container: "mp4",
  codec: "h264",
  width: 1920,
  height: 1080,
  displayWidth: 1920,
  displayHeight: 1080,
  rotationDegrees: 0,
  averageFrameRate: 30,
  variableFrameRate: false,
  hasAudio: false,
  audioCodec: null,
});
const thumbnail = {
  version: 1 as const,
  width: 640,
  height: 360,
  timestampMilliseconds: 1000,
};
beforeAll(async () => {
  await pg.exec(
    `create table media_assets(id uuid primary key,workspace_id uuid,kind text,status text,inspection_status text,deleted_at timestamptz,verified_metadata jsonb,updated_at timestamptz);`,
  );
}, 30000);
afterAll(async () => {
  await pg.close();
});
describe("thumbnail metadata updates on isolated PostgreSQL", () => {
  it("merges only preview data while preserving authoritative metadata and ready status", async () => {
    await pg.query(
      "insert into media_assets values($1,$2,'video','ready','succeeded',null,$3,now())",
      [id, workspace, JSON.stringify({ ...metadata, codec: "vp9" })],
    );
    expect(
      await saveMediaAssetThumbnail({
        workspaceId: workspace,
        mediaAssetId: id,
        metadata,
        thumbnail,
      }),
    ).toBe(true);
    const result = await pg.query<{
      verified_metadata: unknown;
      status: string;
      inspection_status: string;
    }>(
      "select verified_metadata,status,inspection_status from media_assets where id=$1",
      [id],
    );
    expect(result.rows[0]).toMatchObject({
      verified_metadata: { ...metadata, codec: "vp9", thumbnail },
      status: "ready",
      inspection_status: "succeeded",
    });
  });
  it("rejects another workspace and assets no longer usable", async () => {
    expect(
      await saveMediaAssetThumbnail({
        workspaceId: id,
        mediaAssetId: id,
        metadata,
        thumbnail,
      }),
    ).toBe(false);
    await pg.query("update media_assets set deleted_at=now() where id=$1", [
      id,
    ]);
    expect(
      await saveMediaAssetThumbnail({
        workspaceId: workspace,
        mediaAssetId: id,
        metadata,
        thumbnail,
      }),
    ).toBe(false);
  });
  it("supports a legacy ready video without changing its inspection status", async () => {
    await pg.query(
      "update media_assets set deleted_at=null,inspection_status=null,verified_metadata=null where id=$1",
      [id],
    );
    expect(
      await saveMediaAssetThumbnail({
        workspaceId: workspace,
        mediaAssetId: id,
        metadata,
        thumbnail,
      }),
    ).toBe(true);
    expect(
      (
        await pg.query<{
          inspection_status: string | null;
          verified_metadata: unknown;
        }>(
          "select inspection_status,verified_metadata from media_assets where id=$1",
          [id],
        )
      ).rows[0],
    ).toMatchObject({
      inspection_status: null,
      verified_metadata: { ...metadata, thumbnail },
    });
  });
});
