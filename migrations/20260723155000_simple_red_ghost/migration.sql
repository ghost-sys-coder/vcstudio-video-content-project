CREATE TYPE "content_idea_source" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TABLE "content_idea_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"niche" text NOT NULL,
	"platform" "content_platform",
	"tone_preference" text,
	"language" text DEFAULT 'English' NOT NULL,
	"requested_count" integer NOT NULL,
	"result_count" integer,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"final_prompt" text NOT NULL,
	"status" "scene_analysis_status" DEFAULT 'completed'::"scene_analysis_status" NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"actual_cost_cents" integer,
	"provider_request_id" text,
	"error_category" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_idea_generation_runs_count_positive" CHECK ("requested_count" > 0),
	CONSTRAINT "content_idea_generation_runs_cost_nonnegative" CHECK ("actual_cost_cents" is null or "actual_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"generation_run_id" uuid,
	"niche" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"target_duration_seconds" integer,
	"primary_platform" "content_platform" DEFAULT 'youtube'::"content_platform" NOT NULL,
	"hook_angle" text DEFAULT '' NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"hook_type" text DEFAULT '' NOT NULL,
	"source" "content_idea_source" DEFAULT 'ai'::"content_idea_source" NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_ideas_duration_positive" CHECK ("target_duration_seconds" is null or "target_duration_seconds" > 0)
);
--> statement-breakpoint
CREATE INDEX "content_idea_generation_runs_workspace_created_index" ON "content_idea_generation_runs" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "content_ideas_workspace_niche_index" ON "content_ideas" ("workspace_id","niche");--> statement-breakpoint
CREATE INDEX "content_ideas_workspace_created_index" ON "content_ideas" ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "content_idea_generation_runs" ADD CONSTRAINT "content_idea_generation_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_idea_generation_runs" ADD CONSTRAINT "content_idea_generation_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_lMDmBmjDGfJF_fkey" FOREIGN KEY ("generation_run_id") REFERENCES "content_idea_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;