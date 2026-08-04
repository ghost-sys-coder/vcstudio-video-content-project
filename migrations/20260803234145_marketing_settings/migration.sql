-- Marketing Studio, Slice 0: `marketing_settings`.
--
-- This migration also carries four schema changes that were previously applied
-- with `drizzle-kit push`. `push` mutates the database without writing a
-- migration or a snapshot, so the on-disk snapshot lagged the live schema and
-- `generate` re-emitted them here as though they were new:
--
--   * audit_action                += 'thumbnail_deleted'
--   * content_platform            += 'twitter'
--   * user_theme_preference       += 'dim'
--   * social_post_media            : render_id column, indexes, single-source CHECK
--
-- Dropping them would leave no migration anywhere that contains them, and a
-- database built from scratch would be missing them. Re-running them blindly
-- would fail on the live database, where they already exist. So **every
-- statement below is idempotent**: a no-op where the object already exists, and
-- correct on a fresh database. This is the first step of reconciling the
-- migration journal — see docs/marketing/08-slices.md.
--
-- Verify after applying: pg_enum for the three enums, pg_indexes and
-- pg_constraint for social_post_media and marketing_settings.

DO $$ BEGIN
	CREATE TYPE "marketing_autonomy_level" AS ENUM('manual', 'assisted', 'autonomous');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'thumbnail_deleted' BEFORE 'budget_changed';--> statement-breakpoint
ALTER TYPE "content_platform" ADD VALUE IF NOT EXISTS 'twitter';--> statement-breakpoint
ALTER TYPE "user_theme_preference" ADD VALUE IF NOT EXISTS 'dim' BEFORE 'dark';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"autonomy_level" "marketing_autonomy_level" DEFAULT 'manual'::"marketing_autonomy_level" NOT NULL,
	"require_approval_before_publish" boolean DEFAULT true NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"default_language" text DEFAULT 'English' NOT NULL,
	"branded_default" boolean DEFAULT true NOT NULL,
	"monthly_marketing_budget_cents" integer,
	"daily_max_generated_items" integer DEFAULT 10 NOT NULL,
	"research_refresh_days" integer DEFAULT 7 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_settings_daily_items_positive" CHECK ("daily_max_generated_items" > 0),
	CONSTRAINT "marketing_settings_research_refresh_positive" CHECK ("research_refresh_days" > 0),
	CONSTRAINT "marketing_settings_budget_nonnegative" CHECK ("monthly_marketing_budget_cents" is null or "monthly_marketing_budget_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "social_post_media" ADD COLUMN IF NOT EXISTS "render_id" uuid;--> statement-breakpoint
ALTER TABLE "social_post_media" ALTER COLUMN "media_asset_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_settings_workspace_unique" ON "marketing_settings" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_media_post_render_unique" ON "social_post_media" ("post_id","render_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_media_render_index" ON "social_post_media" ("render_id");--> statement-breakpoint
ALTER TABLE "marketing_settings" DROP CONSTRAINT IF EXISTS "marketing_settings_workspace_id_workspaces_id_fkey";--> statement-breakpoint
ALTER TABLE "marketing_settings" ADD CONSTRAINT "marketing_settings_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_settings" DROP CONSTRAINT IF EXISTS "marketing_settings_updated_by_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "marketing_settings" ADD CONSTRAINT "marketing_settings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_post_media" DROP CONSTRAINT IF EXISTS "social_post_media_render_id_video_renders_id_fkey";--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_render_id_video_renders_id_fkey" FOREIGN KEY ("render_id") REFERENCES "video_renders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_post_media" DROP CONSTRAINT IF EXISTS "social_post_media_single_source";--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_single_source" CHECK (("media_asset_id" is not null) <> ("render_id" is not null));
