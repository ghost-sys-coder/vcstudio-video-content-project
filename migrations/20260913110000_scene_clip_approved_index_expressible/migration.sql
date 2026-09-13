-- The approved-clip index needs two things at once: it must be partial, so only
-- approved rows compete, and it must treat two null output variants as the same
-- value, because null is how a clip for the project's own shape is stored and
-- Postgres would otherwise let two approved clips claim one scene.
--
-- `NULLS NOT DISTINCT`, used by the previous migration, says that plainly but
-- cannot be declared in Drizzle: it is offered on unique constraints, which
-- cannot carry a WHERE clause, not on unique indexes. This repository runs
-- `drizzle-kit push`, so an index the schema cannot express is an index that a
-- later push will try to "correct", which is precisely how a check constraint
-- has been silently rewritten here before.
--
-- Collapsing the null with coalesce says the same thing in a form the schema
-- can declare exactly, so the database and `db/schema.ts` agree character for
-- character. The nil UUID is safe as the stand-in: `gen_random_uuid` never
-- produces it, so no real output variant can collide with it.
DROP INDEX IF EXISTS "scene_video_generations_approved_scene_version_variant_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_approved_scene_version_variant_unique" ON "scene_video_generations" USING btree ("scene_version_id",coalesce("output_variant_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "scene_video_generations"."review_status" = 'approved';
