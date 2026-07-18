CREATE TYPE "subtitle_granularity" AS ENUM('scene', 'sentence');--> statement-breakpoint
CREATE TABLE "project_subtitle_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"granularity" "subtitle_granularity" DEFAULT 'sentence'::"subtitle_granularity" NOT NULL,
	"caption_style" jsonb NOT NULL,
	"segment_text_overrides" jsonb DEFAULT '{}' NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_subtitle_settings_project_unique" ON "project_subtitle_settings" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_subtitle_settings_id_workspace_unique" ON "project_subtitle_settings" ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "project_subtitle_settings" ADD CONSTRAINT "project_subtitle_settings_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_subtitle_settings" ADD CONSTRAINT "project_subtitle_settings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_subtitle_settings" ADD CONSTRAINT "project_subtitle_settings_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;