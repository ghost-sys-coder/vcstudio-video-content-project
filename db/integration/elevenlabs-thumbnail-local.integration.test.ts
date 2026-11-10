import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import { claimElevenLabsThumbnail } from "@/db/commands/image-provider-handle";
const pg = new PGlite();
const database = drizzle({ client: pg });
beforeAll(async () => {
  await pg.exec(
    "create table thumbnail_generations(id uuid primary key,workspace_id uuid not null,project_id uuid not null,status text not null,attempt_count int not null,progress_percent int not null,started_at timestamptz,updated_at timestamptz);",
  );
});
afterAll(() => pg.close());
it("only one tenant-scoped worker can claim the billable thumbnail submission", async () => {
  const input = {
    workspaceId: randomUUID(),
    projectId: randomUUID(),
    generationId: randomUUID(),
  };
  await pg.query(
    "insert into thumbnail_generations(id,workspace_id,project_id,status,attempt_count,progress_percent) values($1,$2,$3,'queued',0,0)",
    [input.generationId, input.workspaceId, input.projectId],
  );
  expect(
    await claimElevenLabsThumbnail({ ...input, workspaceId: randomUUID() }),
  ).toBe(false);
  expect(await claimElevenLabsThumbnail(input)).toBe(true);
  expect(await claimElevenLabsThumbnail(input)).toBe(false);
  expect(
    (
      await pg.query(
        "select status,attempt_count from thumbnail_generations where id=$1",
        [input.generationId],
      )
    ).rows,
  ).toEqual([{ status: "running", attempt_count: 1 }]);
});
