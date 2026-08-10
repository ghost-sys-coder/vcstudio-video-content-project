CREATE TYPE "media_inspection_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "inspection_status" "media_inspection_status";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "verified_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "inspection_warnings" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "inspection_trigger_run_id" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "inspection_error" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "inspected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "inspection_status" "media_inspection_status";--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "verified_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "inspection_warnings" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "inspection_trigger_run_id" text;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "inspection_error" text;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "inspected_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "media_assets"
SET "status" = 'pending', "inspection_status" = 'pending', "inspection_trigger_run_id" = NULL
WHERE "kind" = 'video' AND "status" = 'ready';
--> statement-breakpoint
UPDATE "scene_audio_generations"
SET "inspection_status" = 'pending', "inspection_trigger_run_id" = NULL
WHERE "source" = 'user_recorded' AND "status" = 'succeeded';
