ALTER TABLE "scene_image_batches" DROP CONSTRAINT "scene_image_batches_size_supported";--> statement-breakpoint
DROP INDEX "scene_image_generations_approved_scene_version_unique";--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD COLUMN "sizes" text[];--> statement-breakpoint
UPDATE "scene_image_batches" SET "sizes" = ARRAY["size"] WHERE "size" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_batches" ALTER COLUMN "sizes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_batches" DROP COLUMN "size";--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_approved_scene_version_size_unique" ON "scene_image_generations" ("scene_version_id","size") WHERE "review_status" = 'approved';--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD CONSTRAINT "scene_image_batches_sizes_supported" CHECK (array_length("sizes", 1) > 0 and "sizes" <@ array['1536x1024', '1024x1536', '1024x1024']::text[]);
