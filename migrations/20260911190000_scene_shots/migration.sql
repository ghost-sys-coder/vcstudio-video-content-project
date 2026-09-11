ALTER TABLE "scene_image_generations" ADD COLUMN IF NOT EXISTS "shot_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_shot_index_nonnegative" CHECK ("scene_image_generations"."shot_index" >= 0);--> statement-breakpoint
DROP INDEX IF EXISTS "scene_image_generations_approved_scene_version_size_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_approved_scene_version_size_unique" ON "scene_image_generations" USING btree ("scene_version_id","size","shot_index") WHERE "scene_image_generations"."review_status" = 'approved';
