import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const pg = new PGlite();
const w1 = "11111111-1111-4111-8111-111111111111",
  w2 = "22222222-2222-4222-8222-222222222222";
const post = "33333333-3333-4333-8333-333333333333",
  account = "44444444-4444-4444-8444-444444444444",
  foreign = "55555555-5555-4555-8555-555555555555";
beforeAll(async () => {
  await pg.exec(`
    create table workspaces(id uuid primary key);
    create table social_posts(id uuid primary key, workspace_id uuid, unique(id,workspace_id));
    create table platform_connections(id uuid primary key, workspace_id uuid, unique(id,workspace_id));
    create table social_post_targets(id int primary key, post_id uuid,workspace_id uuid,connection_id uuid,status text);
    insert into workspaces values ('${w1}'),('${w2}');
    insert into social_posts values ('${post}','${w1}');
    insert into platform_connections values ('${account}','${w1}'),('${foreign}','${w2}');
    insert into social_post_targets values (1,'${post}','${w1}','${account}','published'),(2,'${post}','${w1}','${foreign}','pending');
  `);
  await pg.exec(
    await readFile(
      "migrations/20261104104742_social_post_draft_destinations/migration.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await pg.close();
});
describe("draft destination migration on isolated PostgreSQL", () => {
  it("backfills only tenant-valid existing accounts without altering target outcomes", async () => {
    expect(
      (
        await pg.query(
          "select workspace_id,post_id,connection_id from social_post_draft_destinations",
        )
      ).rows,
    ).toEqual([{ workspace_id: w1, post_id: post, connection_id: account }]);
    expect(
      (await pg.query("select id,status from social_post_targets order by id"))
        .rows,
    ).toEqual([
      { id: 1, status: "published" },
      { id: 2, status: "pending" },
    ]);
  });
  it("enforces both post and connection tenant constraints", async () => {
    await expect(
      pg.query(
        "insert into social_post_draft_destinations(workspace_id,post_id,connection_id) values ($1,$2,$3)",
        [w1, post, foreign],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into social_post_draft_destinations(workspace_id,post_id,connection_id) values ($1,$2,$3)",
        [w2, post, foreign],
      ),
    ).rejects.toThrow();
  });
});
