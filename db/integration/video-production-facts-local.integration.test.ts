import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const pg = new PGlite();
vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({
    execute: async (query: SQL) => {
      const compiled = new PgDialect().sqlToQuery(query);
      return pg.query(compiled.sql, compiled.params);
    },
  }),
}));
import { loadVideoProductionFacts } from "@/db/repositories/video-production-facts.repository";
const workspace = randomUUID(),
  other = randomUUID(),
  project = randomUUID(),
  foreignProject = randomUUID();
const still = randomUUID(),
  clip = randomUUID(),
  looped = randomUUID(),
  stillVersion = randomUUID(),
  clipVersion = randomUUID(),
  loopVersion = randomUUID();
beforeAll(async () => {
  await pg.exec(`
    create table projects(id uuid primary key,workspace_id uuid,default_visual_media text,frames_per_second int);
    create table scenes(id uuid primary key,workspace_id uuid,project_id uuid,current_version int);
    create table scene_versions(id uuid primary key,scene_id uuid,project_id uuid,workspace_id uuid,version_number int);
    create table scene_visual_selections(scene_version_id uuid,workspace_id uuid,kind text,object_key text,review_status text,duration_milliseconds int,trim_start_milliseconds int,loop boolean,revision int);
    create table scene_audio_generations(scene_version_id uuid,workspace_id uuid,status text,review_status text,duration_milliseconds int,created_at timestamptz default now());
    create table scene_image_generations(scene_version_id uuid,workspace_id uuid,status text,review_status text);
    insert into projects values('${project}','${workspace}','image',24),('${foreignProject}','${other}','video',30);
    insert into scenes values('${still}','${workspace}','${project}',2),('${clip}','${workspace}','${project}',1),('${looped}','${workspace}','${project}',1);
    insert into scene_versions values('${stillVersion}','${still}','${project}','${workspace}',2),('${clipVersion}','${clip}','${project}','${workspace}',1),('${loopVersion}','${looped}','${project}','${workspace}',1);
    insert into scene_image_generations values('${stillVersion}','${workspace}','succeeded','approved');
    insert into scene_visual_selections values('${clipVersion}','${workspace}','video','clip.mp4','pending',1000,0,false,1),('${clipVersion}','${workspace}','video','clip.mp4','approved',1000,0,false,2),('${loopVersion}','${workspace}','video','loop.mp4','approved',500,0,true,1);
    insert into scene_audio_generations(scene_version_id,workspace_id,status,review_status,duration_milliseconds) values('${clipVersion}','${workspace}','succeeded','approved',1040),('${loopVersion}','${workspace}','succeeded','approved',2000);
  `);
}, 30000);
afterAll(() => pg.close());
describe("actual bounded mixed-media readiness query", () => {
  it("counts latest selected footage, explicit loops and the project's actual frame tolerance", async () => {
    const facts = await loadVideoProductionFacts({
      workspaceId: workspace,
      projectIds: [project, foreignProject],
    });
    expect(facts.size).toBe(1);
    expect(facts.get(project)).toEqual({
      imagesSucceeded: 1,
      imagesAwaitingReview: 0,
      imagesFailed: 0,
      imagesMissing: 0,
      videosSucceeded: 2,
      videosAwaitingReview: 0,
      videosMissing: 0,
      videosTooShort: 0,
    });
    await pg.exec(
      `update scene_audio_generations set duration_milliseconds=1100 where scene_version_id='${clipVersion}'`,
    );
    expect(
      (
        await loadVideoProductionFacts({
          workspaceId: workspace,
          projectIds: [project],
        })
      ).get(project)?.videosTooShort,
    ).toBe(1);
  });
  it("does not query an empty page or disclose another workspace's projects", async () => {
    expect(
      await loadVideoProductionFacts({
        workspaceId: workspace,
        projectIds: [],
      }),
    ).toEqual(new Map());
    expect(
      await loadVideoProductionFacts({
        workspaceId: other,
        projectIds: [project],
      }),
    ).toEqual(new Map());
  });
});
