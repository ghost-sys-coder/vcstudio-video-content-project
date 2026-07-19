CREATE TYPE "audit_action" AS ENUM('workspace_created', 'role_changed', 'project_archived', 'project_restored', 'script_restored', 'scene_approved', 'asset_approved', 'generation_started', 'generation_cancelled', 'render_started', 'export_deleted', 'budget_changed', 'limits_changed');--> statement-breakpoint
CREATE TABLE "audit_log_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"project_id" uuid,
	"action" "audit_action" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"safe_metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_budget_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"daily_budget_cents" integer NOT NULL,
	"monthly_budget_cents" integer NOT NULL,
	"manual_confirmation_threshold_cents" integer NOT NULL,
	"max_images_per_batch" integer,
	"max_scenes_per_audio_batch" integer,
	"max_render_duration_seconds" integer,
	"max_retry_attempts" integer,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_budget_settings_budgets_nonnegative" CHECK ("daily_budget_cents" >= 0 and "monthly_budget_cents" >= 0 and "manual_confirmation_threshold_cents" >= 0),
	CONSTRAINT "workspace_budget_settings_overrides_valid" CHECK (("max_images_per_batch" is null or "max_images_per_batch" > 0) and ("max_scenes_per_audio_batch" is null or "max_scenes_per_audio_batch" > 0) and ("max_render_duration_seconds" is null or "max_render_duration_seconds" > 0) and ("max_retry_attempts" is null or "max_retry_attempts" >= 0))
);
--> statement-breakpoint
CREATE INDEX "audit_log_events_workspace_created_index" ON "audit_log_events" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_events_workspace_action_created_index" ON "audit_log_events" ("workspace_id","action","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_events_workspace_project_created_index" ON "audit_log_events" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_budget_settings_workspace_unique" ON "workspace_budget_settings" ("workspace_id");--> statement-breakpoint
ALTER TABLE "audit_log_events" ADD CONSTRAINT "audit_log_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_log_events" ADD CONSTRAINT "audit_log_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "workspace_budget_settings" ADD CONSTRAINT "workspace_budget_settings_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_budget_settings" ADD CONSTRAINT "workspace_budget_settings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;