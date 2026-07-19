CREATE TYPE "content_platform" AS ENUM('youtube', 'tiktok', 'facebook', 'instagram');--> statement-breakpoint
ALTER TYPE "usage_operation_type" ADD VALUE 'script_generation';--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"target_duration_seconds" integer,
	"primary_platform" "content_platform" DEFAULT 'youtube'::"content_platform" NOT NULL,
	"hook_angle" text DEFAULT '' NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_briefs_duration_positive" CHECK ("target_duration_seconds" is null or "target_duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "script_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
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
	"generated_content" text,
	"suggested_title" text,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_generation_runs_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "script_generation_runs_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "script_generation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "project_briefs_project_unique" ON "project_briefs" ("project_id");--> statement-breakpoint
CREATE INDEX "project_briefs_workspace_project_index" ON "project_briefs" ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "script_generation_runs_idempotency_unique" ON "script_generation_runs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "script_generation_runs_workspace_project_index" ON "script_generation_runs" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_script_generation_unique" ON "usage_reservations" ("script_generation_id") WHERE "script_generation_id" is not null;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "script_generation_runs" ADD CONSTRAINT "script_generation_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "script_generation_runs" ADD CONSTRAINT "script_generation_runs_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "script_generation_runs" ADD CONSTRAINT "script_generation_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_PcBS9yrNIsvO_fkey" FOREIGN KEY ("script_generation_id") REFERENCES "script_generation_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null and "script_generation_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null and "script_generation_id" is null) or ("operation_type"::text = 'script_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is not null));