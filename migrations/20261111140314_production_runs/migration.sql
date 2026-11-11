CREATE TYPE "production_run_stage" AS ENUM('script', 'scenes', 'images', 'audio', 'render', 'release');--> statement-breakpoint
CREATE TYPE "production_run_status" AS ENUM('queued', 'running', 'held', 'ready_for_review', 'failed', 'cancelled');--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'production_run_started';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'production_run_held';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'production_run_ready';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'production_run_failed';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'production_run_cancelled';--> statement-breakpoint
CREATE TABLE "production_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stage" "production_run_stage" NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_run_events_kind_valid" CHECK ("kind" in ('run_started','stage_started','stage_waiting','stage_completed','stage_retried','gate_passed','gate_failed','budget_refused','held','resumed','ready_for_review','failed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "production_run_gate_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stage" "production_run_stage" NOT NULL,
	"subject" text NOT NULL,
	"subject_id" text NOT NULL,
	"label" text NOT NULL,
	"verdict" text NOT NULL,
	"score" integer,
	"reasons" jsonb DEFAULT '[]' NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_run_gate_results_subject_valid" CHECK ("subject" in ('script','scene_plan','scene_image','scene_audio','render')),
	CONSTRAINT "production_run_gate_results_verdict_valid" CHECK ("verdict" in ('pass','warn','fail')),
	CONSTRAINT "production_run_gate_results_score_range" CHECK ("score" is null or "score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "production_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "production_run_status" DEFAULT 'queued'::"production_run_status" NOT NULL,
	"stage" "production_run_stage" DEFAULT 'script'::"production_run_stage" NOT NULL,
	"policy" jsonb NOT NULL,
	"attempts" jsonb DEFAULT '{}' NOT NULL,
	"stage_references" jsonb DEFAULT '{}' NOT NULL,
	"spent_cost_cents" integer DEFAULT 0 NOT NULL,
	"hold_reason" text,
	"safe_error_message" text,
	"trigger_run_id" text,
	"requested_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_runs_spent_nonnegative" CHECK ("spent_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX "production_run_events_run_index" ON "production_run_events" ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "production_run_gate_results_run_index" ON "production_run_gate_results" ("run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "production_runs_id_workspace_unique" ON "production_runs" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_runs_active_unique" ON "production_runs" ("project_id") WHERE status in ('queued', 'running', 'held');--> statement-breakpoint
CREATE INDEX "production_runs_workspace_project_index" ON "production_runs" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "production_runs_status_updated_index" ON "production_runs" ("status","updated_at");--> statement-breakpoint
ALTER TABLE "production_run_events" ADD CONSTRAINT "production_run_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_run_events" ADD CONSTRAINT "production_run_events_tenant_run_fkey" FOREIGN KEY ("run_id","workspace_id") REFERENCES "production_runs"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_run_gate_results" ADD CONSTRAINT "production_run_gate_results_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_run_gate_results" ADD CONSTRAINT "production_run_gate_results_tenant_run_fkey" FOREIGN KEY ("run_id","workspace_id") REFERENCES "production_runs"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;