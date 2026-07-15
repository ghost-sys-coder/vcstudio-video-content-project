CREATE TYPE "scene_analysis_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "scene_status" AS ENUM('draft', 'review', 'approved', 'generating', 'generated', 'revisionRequired', 'locked');--> statement-breakpoint
CREATE TYPE "script_version_status" AS ENUM('draft', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "usage_reservation_status" AS ENUM('pending', 'reconciled', 'released');--> statement-breakpoint
CREATE TABLE "scene_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"script_version_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"final_prompt" text NOT NULL,
	"status" "scene_analysis_status" DEFAULT 'pending'::"scene_analysis_status" NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_analysis_runs_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "scene_analysis_runs_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scene_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"narration_text" text NOT NULL,
	"visual_description" text NOT NULL,
	"location_description" text NOT NULL,
	"action_description" text NOT NULL,
	"camera_shot" text NOT NULL,
	"camera_angle" text NOT NULL,
	"camera_motion" text NOT NULL,
	"emotional_tone" text NOT NULL,
	"character_names" jsonb NOT NULL,
	"prop_names" jsonb NOT NULL,
	"continuity_notes" text NOT NULL,
	"estimated_duration_milliseconds" integer NOT NULL,
	"start_time_milliseconds" integer NOT NULL,
	"end_time_milliseconds" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_versions_duration_positive" CHECK ("estimated_duration_milliseconds" > 0),
	CONSTRAINT "scene_versions_timing_valid" CHECK ("start_time_milliseconds" >= 0 and "end_time_milliseconds" > "start_time_milliseconds")
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"script_version_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"scene_number" integer NOT NULL,
	"status" "scene_status" DEFAULT 'draft'::"scene_status" NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenes_number_positive" CHECK ("scene_number" > 0),
	CONSTRAINT "scenes_version_positive" CHECK ("current_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "usage_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"status" "usage_reservation_status" DEFAULT 'pending'::"usage_reservation_status" NOT NULL,
	"reserved_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_reservations_cost_nonnegative" CHECK ("reserved_cost_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD COLUMN "status" "script_version_status" DEFAULT 'draft'::"script_version_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_analysis_runs_idempotency_unique" ON "scene_analysis_runs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "scene_analysis_runs_workspace_project_index" ON "scene_analysis_runs" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_script_versions_one_approved_unique" ON "project_script_versions" ("project_id") WHERE "status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "scene_versions_scene_number_unique" ON "scene_versions" ("scene_id","version_number");--> statement-breakpoint
CREATE INDEX "scene_versions_workspace_project_index" ON "scene_versions" ("workspace_id","project_id","scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenes_analysis_number_unique" ON "scenes" ("analysis_run_id","scene_number");--> statement-breakpoint
CREATE INDEX "scenes_workspace_project_number_index" ON "scenes" ("workspace_id","project_id","scene_number");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_analysis_unique" ON "usage_reservations" ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "usage_reservations_workspace_project_status_index" ON "usage_reservations" ("workspace_id","project_id","status");--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_approved_by_user_id_users_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_analysis_runs" ADD CONSTRAINT "scene_analysis_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_analysis_runs" ADD CONSTRAINT "scene_analysis_runs_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_analysis_runs" ADD CONSTRAINT "scene_analysis_runs_gGQoXbIK0O0R_fkey" FOREIGN KEY ("script_version_id") REFERENCES "project_script_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_analysis_runs" ADD CONSTRAINT "scene_analysis_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_scene_id_scenes_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_script_version_id_project_script_versions_id_fkey" FOREIGN KEY ("script_version_id") REFERENCES "project_script_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_analysis_run_id_scene_analysis_runs_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "scene_analysis_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_analysis_run_id_scene_analysis_runs_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "scene_analysis_runs"("id") ON DELETE CASCADE;
