ALTER TYPE "social_post_status" ADD VALUE 'awaiting_completion';--> statement-breakpoint
ALTER TYPE "social_post_target_status" ADD VALUE 'inbox_delivered';--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD COLUMN "youtube_settings" jsonb;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD COLUMN "youtube_thumbnail_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD COLUMN "youtube_thumbnail_status" text;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD COLUMN "youtube_thumbnail_error" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "youtube_settings" jsonb;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "youtube_thumbnail_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_youtube_thumbnail_workspace_fk" FOREIGN KEY ("youtube_thumbnail_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_youtube_thumbnail_workspace_fk" FOREIGN KEY ("youtube_thumbnail_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_youtube_thumbnail_status_check" CHECK ("youtube_thumbnail_status" is null or ("platform"::text = 'youtube' and "youtube_thumbnail_asset_id" is not null and "youtube_thumbnail_status" in ('pending','succeeded','failed','unsupported')));--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_inbox_platform_check" CHECK ("status"::text <> 'inbox_delivered' or "platform"::text = 'tiktok');