DO $$ BEGIN
 CREATE TYPE "public"."reframe_job_status" AS ENUM('extending', 'rendering', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_reframe_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"output_variant_id" uuid NOT NULL,
	"status" "public"."reframe_job_status" DEFAULT 'extending' NOT NULL,
	"scene_count" integer DEFAULT 0 NOT NULL,
	"extend_count" integer DEFAULT 0 NOT NULL,
	"crop_count" integer DEFAULT 0 NOT NULL,
	"ready_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"extend_generation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cropped_scene_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"render_id" uuid,
	"safe_error_message" text,
	"trigger_run_id" text,
	"requested_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "project_reframe_jobs_counts_nonnegative" CHECK ("project_reframe_jobs"."scene_count" >= 0 and "project_reframe_jobs"."extend_count" >= 0 and "project_reframe_jobs"."crop_count" >= 0 and "project_reframe_jobs"."ready_count" >= 0),
	CONSTRAINT "project_reframe_jobs_cost_nonnegative" CHECK ("project_reframe_jobs"."estimated_cost_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_reframe_jobs" ADD CONSTRAINT "project_reframe_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reframe_jobs" ADD CONSTRAINT "project_reframe_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reframe_jobs" ADD CONSTRAINT "project_reframe_jobs_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reframe_jobs" ADD CONSTRAINT "project_reframe_jobs_tenant_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "public"."project_output_variants"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_reframe_jobs_id_workspace_unique" ON "project_reframe_jobs" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_reframe_jobs_active_unique" ON "project_reframe_jobs" USING btree ("project_id","output_variant_id") WHERE status in ('extending', 'rendering');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_reframe_jobs_workspace_project_index" ON "project_reframe_jobs" USING btree ("workspace_id","project_id","created_at");
