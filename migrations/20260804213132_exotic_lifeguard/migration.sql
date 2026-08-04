CREATE TYPE "marketing_content_kind" AS ENUM('social_post', 'ad_creative', 'blog_post', 'email', 'newsletter', 'media_story', 'graphic');--> statement-breakpoint
CREATE TYPE "marketing_content_status" AS ENUM('draft', 'needs_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "marketing_revision_source" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "marketing_traffic_type" AS ENUM('organic', 'paid', 'both');--> statement-breakpoint
CREATE TABLE "marketing_content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"kind" "marketing_content_kind" NOT NULL,
	"platform" "content_platform",
	"traffic_type" "marketing_traffic_type" DEFAULT 'organic'::"marketing_traffic_type" NOT NULL,
	"is_branded" boolean DEFAULT true NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body_document" jsonb DEFAULT '{"type":"doc","content":[]}' NOT NULL,
	"body_plain_text" text DEFAULT '' NOT NULL,
	"structured_payload" jsonb,
	"status" "marketing_content_status" DEFAULT 'draft'::"marketing_content_status" NOT NULL,
	"scheduled_for" timestamp with time zone,
	"social_post_id" uuid,
	"source_run_id" uuid,
	"created_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"review_notes" text DEFAULT '' NOT NULL,
	"approved_at" timestamp with time zone,
	"error_category" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_content_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"body_document" jsonb NOT NULL,
	"body_plain_text" text NOT NULL,
	"structured_payload" jsonb,
	"change_source" "marketing_revision_source" NOT NULL,
	"changed_by_user_id" uuid,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_content_revisions_number_positive" CHECK ("revision_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_content_items_id_workspace_unique" ON "marketing_content_items" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_content_items_social_post_unique" ON "marketing_content_items" ("social_post_id") WHERE "social_post_id" is not null;--> statement-breakpoint
CREATE INDEX "marketing_content_items_queue_index" ON "marketing_content_items" ("workspace_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_content_media_position_unique" ON "marketing_content_media" ("content_item_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_content_media_asset_unique" ON "marketing_content_media" ("content_item_id","media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_content_revisions_number_unique" ON "marketing_content_revisions" ("content_item_id","revision_number");--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_social_post_id_social_posts_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_6PG9qSGUkIGe_fkey" FOREIGN KEY ("source_run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_media" ADD CONSTRAINT "marketing_content_media_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_content_media" ADD CONSTRAINT "marketing_content_media_tenant_item_fkey" FOREIGN KEY ("content_item_id","workspace_id") REFERENCES "marketing_content_items"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_content_media" ADD CONSTRAINT "marketing_content_media_tenant_asset_fkey" FOREIGN KEY ("media_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_content_revisions" ADD CONSTRAINT "marketing_content_revisions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_content_revisions" ADD CONSTRAINT "marketing_content_revisions_changed_by_user_id_users_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_revisions" ADD CONSTRAINT "marketing_content_revisions_9zelryubatmO_fkey" FOREIGN KEY ("run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_revisions" ADD CONSTRAINT "marketing_content_revisions_tenant_item_fkey" FOREIGN KEY ("content_item_id","workspace_id") REFERENCES "marketing_content_items"("id","workspace_id") ON DELETE CASCADE;