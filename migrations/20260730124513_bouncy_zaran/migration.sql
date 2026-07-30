CREATE TYPE "social_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'partially_failed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "social_post_target_status" AS ENUM('pending', 'queued', 'publishing', 'published', 'failed', 'cancelled');--> statement-breakpoint
ALTER TYPE "content_platform" ADD VALUE 'linkedin';--> statement-breakpoint
CREATE TABLE "social_post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"post_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"post_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" "social_post_target_status" DEFAULT 'pending'::"social_post_target_status" NOT NULL,
	"override_body_plain_text" text,
	"external_post_id" text,
	"external_post_url" text,
	"provider_operation_id" text,
	"provider_operation_secret_sealed" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"error_category" text,
	"safe_error_message" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"body_document" jsonb DEFAULT '{"type":"doc","content":[]}' NOT NULL,
	"body_plain_text" text DEFAULT '' NOT NULL,
	"status" "social_post_status" DEFAULT 'draft'::"social_post_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"scheduled_timezone" text DEFAULT 'UTC' NOT NULL,
	"project_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_scheduled_requires_time" CHECK ("status" <> 'scheduled' or "scheduled_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_post_media_post_position_unique" ON "social_post_media" ("post_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "social_post_media_post_asset_unique" ON "social_post_media" ("post_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "social_post_media_asset_index" ON "social_post_media" ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_post_targets_idempotency_unique" ON "social_post_targets" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "social_post_targets_post_connection_unique" ON "social_post_targets" ("post_id","connection_id");--> statement-breakpoint
CREATE INDEX "social_post_targets_post_index" ON "social_post_targets" ("post_id","status");--> statement-breakpoint
CREATE INDEX "social_post_targets_workspace_status_index" ON "social_post_targets" ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_id_workspace_unique" ON "social_posts" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "social_posts_workspace_status_index" ON "social_posts" ("workspace_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_workspace_created_index" ON "social_posts" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "social_posts_due_index" ON "social_posts" ("status","scheduled_at");--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_post_id_social_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_media_asset_id_media_assets_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_id_social_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_connection_id_platform_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;