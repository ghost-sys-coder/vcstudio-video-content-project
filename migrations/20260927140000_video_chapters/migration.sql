-- YouTube chapters for a render: an AI pass that picks chapter boundaries
-- (billable, so it gets its own usage operation) and the edited chapters a
-- render is published with.
--
-- The enum value is compared as text in the CHECK below, never as an enum
-- literal, so adding it in the same transaction is safe.
ALTER TYPE "usage_operation_type" ADD VALUE IF NOT EXISTS 'chapter_generation';--> statement-breakpoint

CREATE TABLE "chapter_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"render_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"final_prompt" text NOT NULL,
	"status" "scene_analysis_status" DEFAULT 'pending' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"generated_chapters" jsonb,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_generation_runs_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "chapter_generation_runs_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);--> statement-breakpoint

CREATE TABLE "video_render_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"render_id" uuid NOT NULL,
	"chapters" jsonb NOT NULL,
	"include_in_youtube_description" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"chapter_generation_run_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_render_chapters_source_valid" CHECK ("source" in ('generated', 'edited')),
	CONSTRAINT "video_render_chapters_version_positive" CHECK ("version" > 0)
);--> statement-breakpoint

ALTER TABLE "usage_reservations" ADD COLUMN "chapter_generation_id" uuid;--> statement-breakpoint

ALTER TABLE "chapter_generation_runs" ADD CONSTRAINT "chapter_generation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_runs" ADD CONSTRAINT "chapter_generation_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_runs" ADD CONSTRAINT "chapter_generation_runs_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_runs" ADD CONSTRAINT "chapter_generation_runs_tenant_render_fkey" FOREIGN KEY ("render_id","project_id","workspace_id") REFERENCES "public"."video_renders"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_chapters" ADD CONSTRAINT "video_render_chapters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_chapters" ADD CONSTRAINT "video_render_chapters_chapter_generation_run_id_chapter_generation_runs_id_fk" FOREIGN KEY ("chapter_generation_run_id") REFERENCES "public"."chapter_generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_chapters" ADD CONSTRAINT "video_render_chapters_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_chapters" ADD CONSTRAINT "video_render_chapters_tenant_render_fkey" FOREIGN KEY ("render_id","project_id","workspace_id") REFERENCES "public"."video_renders"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_chapter_generation_id_chapter_generation_runs_id_fk" FOREIGN KEY ("chapter_generation_id") REFERENCES "public"."chapter_generation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "chapter_generation_runs_idempotency_unique" ON "chapter_generation_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "chapter_generation_runs_workspace_render_index" ON "chapter_generation_runs" USING btree ("workspace_id","render_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_render_chapters_render_unique" ON "video_render_chapters" USING btree ("render_id");--> statement-breakpoint
CREATE INDEX "video_render_chapters_workspace_project_index" ON "video_render_chapters" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_chapter_generation_unique" ON "usage_reservations" USING btree ("chapter_generation_id") WHERE "usage_reservations"."chapter_generation_id" is not null;--> statement-breakpoint

-- Every existing branch now also requires no chapter id, and a ninth branch
-- admits chapter reservations. `drizzle-kit push` does not re-apply a changed
-- CHECK, so this must be applied as written.
ALTER TABLE "usage_reservations" DROP CONSTRAINT IF EXISTS "usage_reservations_single_operation";--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'script_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is not null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'title_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is not null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'thumbnail_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is not null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_video_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is not null and "chapter_generation_id" is null) or ("operation_type"::text = 'chapter_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is not null));
