import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const pg = new PGlite(),
  database = drizzle({ client: pg });
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import {
  listMcpUploadChunkCleanup,
  markMcpUploadChunksCleaned,
} from "@/db/repositories/mcp.repository";
const workspace = randomUUID(),
  other = randomUUID(),
  selected = randomUUID(),
  asset = randomUUID();
beforeAll(async () => {
  await pg.exec(
    `create table mcp_operations(id uuid primary key,workspace_id uuid,connection_id uuid,user_id uuid,kind text,idempotency_key text,fingerprint text,status text,input jsonb,result jsonb,error text,sealed_source text,approval_hash text,trigger_run_id text,expires_at timestamptz default now()+interval '1 hour',created_at timestamptz default now()-interval '2 hours',updated_at timestamptz default now()-interval '1 hour');`,
  );
  for (const [id, status, sourceKind, cleaned] of [
    [selected, "succeeded", "mcp_upload", false],
    [randomUUID(), "awaiting_upload", "mcp_upload", false],
    [randomUUID(), "failed", "url", false],
    [randomUUID(), "failed", "mcp_upload", true],
  ])
    await pg.query(
      "insert into mcp_operations(id,workspace_id,kind,status,input,result) values($1,$2,'import_asset',$3,$4,$5)",
      [
        id,
        workspace,
        status,
        JSON.stringify({ sourceKind }),
        JSON.stringify({ mediaAssetId: asset, uploadChunksCleaned: cleaned }),
      ],
    );
}, 30000);
afterAll(async () => {
  await pg.close();
});
describe("bounded staged-upload cleanup SQL", () => {
  it("selects only old terminal chunk uploads without touching other import paths", async () => {
    expect((await listMcpUploadChunkCleanup()).map((op) => op.id)).toEqual([
      selected,
    ]);
  });
  it("scopes cleanup markers by workspace and preserves the completed asset result", async () => {
    await markMcpUploadChunksCleaned(other, selected);
    expect((await listMcpUploadChunkCleanup()).map((op) => op.id)).toContain(
      selected,
    );
    await markMcpUploadChunksCleaned(workspace, selected);
    const row = (
      await pg.query<{ result: unknown; status: string }>(
        "select result,status from mcp_operations where id=$1",
        [selected],
      )
    ).rows[0];
    expect(row).toEqual({
      status: "succeeded",
      result: { mediaAssetId: asset, uploadChunksCleaned: true },
    });
    expect(await listMcpUploadChunkCleanup()).toEqual([]);
  });
});
