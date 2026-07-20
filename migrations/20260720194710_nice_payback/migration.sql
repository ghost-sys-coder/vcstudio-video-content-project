ALTER TYPE "usage_operation_type" ADD VALUE 'title_generation';--> statement-breakpoint
CREATE TABLE "project_title_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title_generation_run_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"text" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"hook_type" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_title_suggestions_position_nonnegative" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "title_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"script_version_id" uuid,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"final_prompt" text NOT NULL,
	"requested_option_count" integer NOT NULL,
	"status" "scene_analysis_status" DEFAULT 'pending'::"scene_analysis_status" NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"result_option_count" integer,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_generation_runs_option_count_positive" CHECK ("requested_option_count" > 0),
	CONSTRAINT "title_generation_runs_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "title_generation_runs_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "title_generation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "project_title_suggestions_run_position_unique" ON "project_title_suggestions" ("title_generation_run_id","position");--> statement-breakpoint
CREATE INDEX "project_title_suggestions_workspace_project_platform_index" ON "project_title_suggestions" ("workspace_id","project_id","platform","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "title_generation_runs_id_workspace_unique" ON "title_generation_runs" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "title_generation_runs_idempotency_unique" ON "title_generation_runs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "title_generation_runs_workspace_project_index" ON "title_generation_runs" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_title_generation_unique" ON "usage_reservations" ("title_generation_id") WHERE "title_generation_id" is not null;--> statement-breakpoint
ALTER TABLE "project_title_suggestions" ADD CONSTRAINT "project_title_suggestions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_title_suggestions" ADD CONSTRAINT "project_title_suggestions_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_title_suggestions" ADD CONSTRAINT "project_title_suggestions_tenant_run_fkey" FOREIGN KEY ("title_generation_run_id","workspace_id") REFERENCES "title_generation_runs"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD CONSTRAINT "title_generation_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD CONSTRAINT "title_generation_runs_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD CONSTRAINT "title_generation_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD CONSTRAINT "title_generation_runs_DI51xSpkLd5v_fkey" FOREIGN KEY ("script_version_id") REFERENCES "project_script_versions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "title_generation_runs" ADD CONSTRAINT "title_generation_runs_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_qA5VMlEBolH4_fkey" FOREIGN KEY ("title_generation_id") REFERENCES "title_generation_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null and "script_generation_id" is null and "title_generation_id" is null) or ("operation_type"::text = 'script_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is not null and "title_generation_id" is null) or ("operation_type"::text = 'title_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is not null));