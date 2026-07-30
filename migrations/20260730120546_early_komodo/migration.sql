CREATE TYPE "media_asset_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "media_asset_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'media_asset_deleted' BEFORE 'member_invited';--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"kind" "media_asset_kind" NOT NULL,
	"status" "media_asset_status" DEFAULT 'pending'::"media_asset_status" NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"original_file_name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"width" integer,
	"height" integer,
	"duration_milliseconds" integer,
	"uploaded_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_dimensions_non_negative" CHECK (("width" is null or "width" > 0) and ("height" is null or "height" > 0) and ("duration_milliseconds" is null or "duration_milliseconds" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_object_key_unique" ON "media_assets" ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_id_workspace_unique" ON "media_assets" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "media_assets_workspace_kind_index" ON "media_assets" ("workspace_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_workspace_status_index" ON "media_assets" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_users_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;