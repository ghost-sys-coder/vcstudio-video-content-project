CREATE TYPE "project_aspect_ratio" AS ENUM('16:9', '9:16', '1:1');--> statement-breakpoint
CREATE TYPE "project_status" AS ENUM('draft', 'planning', 'assetGeneration', 'review', 'readyToRender', 'rendering', 'completed', 'failed', 'archived');--> statement-breakpoint
CREATE TABLE "project_script_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"character_count" integer DEFAULT 0 NOT NULL,
	"estimated_narration_duration_seconds" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_script_drafts_revision_nonnegative" CHECK ("revision" >= 0),
	CONSTRAINT "project_script_drafts_character_count_nonnegative" CHECK ("character_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_script_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"character_count" integer NOT NULL,
	"estimated_narration_duration_seconds" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"restored_from_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_script_versions_number_positive" CHECK ("version_number" > 0),
	CONSTRAINT "project_script_versions_character_count_nonnegative" CHECK ("character_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "project_status" DEFAULT 'draft'::"project_status" NOT NULL,
	"aspect_ratio" "project_aspect_ratio" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"frames_per_second" integer NOT NULL,
	"language" text NOT NULL,
	"maximum_budget_cents" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_width_positive" CHECK ("width" > 0),
	CONSTRAINT "projects_height_positive" CHECK ("height" > 0),
	CONSTRAINT "projects_fps_valid" CHECK ("frames_per_second" between 1 and 120),
	CONSTRAINT "projects_budget_nonnegative" CHECK ("maximum_budget_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_script_drafts_project_unique" ON "project_script_drafts" ("project_id");--> statement-breakpoint
CREATE INDEX "project_script_drafts_workspace_project_index" ON "project_script_drafts" ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_script_versions_project_number_unique" ON "project_script_versions" ("project_id","version_number");--> statement-breakpoint
CREATE INDEX "project_script_versions_workspace_project_index" ON "project_script_versions" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_workspace_status_updated_index" ON "projects" ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "projects_workspace_created_index" ON "projects" ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "project_script_drafts" ADD CONSTRAINT "project_script_drafts_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_script_drafts" ADD CONSTRAINT "project_script_drafts_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_script_drafts" ADD CONSTRAINT "project_script_drafts_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_restored_from_fkey" FOREIGN KEY ("restored_from_version_id") REFERENCES "project_script_versions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;