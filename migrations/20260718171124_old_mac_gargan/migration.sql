CREATE TYPE "render_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
ALTER TYPE "usage_operation_type" ADD VALUE 'video_render';--> statement-breakpoint
CREATE TABLE "video_renders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"request_nonce" uuid NOT NULL,
	"status" "render_status" DEFAULT 'pending'::"render_status" NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"preset" text NOT NULL,
	"aspect_ratio" "project_aspect_ratio" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"frames_per_second" integer NOT NULL,
	"include_captions" boolean DEFAULT true NOT NULL,
	"include_watermark" boolean DEFAULT false NOT NULL,
	"scene_count" integer NOT NULL,
	"caption_count" integer DEFAULT 0 NOT NULL,
	"duration_milliseconds" integer NOT NULL,
	"total_frames" integer NOT NULL,
	"timeline_snapshot" jsonb NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"asset_object_key" text,
	"asset_content_type" text,
	"asset_size_bytes" integer,
	"asset_etag" text,
	"output_duration_milliseconds" integer,
	"error_category" text,
	"safe_error_message" text,
	"requested_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_renders_width_positive" CHECK ("width" > 0),
	CONSTRAINT "video_renders_height_positive" CHECK ("height" > 0),
	CONSTRAINT "video_renders_fps_valid" CHECK ("frames_per_second" between 1 and 120),
	CONSTRAINT "video_renders_scene_count_positive" CHECK ("scene_count" > 0),
	CONSTRAINT "video_renders_caption_count_nonnegative" CHECK ("caption_count" >= 0),
	CONSTRAINT "video_renders_duration_positive" CHECK ("duration_milliseconds" > 0 and "total_frames" > 0),
	CONSTRAINT "video_renders_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0)),
	CONSTRAINT "video_renders_progress_range" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "video_renders_output_duration_nonnegative" CHECK ("output_duration_milliseconds" is null or "output_duration_milliseconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "video_render_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_video_render_unique" ON "usage_reservations" ("video_render_id") WHERE "video_render_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "video_renders_id_workspace_unique" ON "video_renders" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_renders_id_project_workspace_unique" ON "video_renders" ("id","project_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_renders_idempotency_unique" ON "video_renders" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_renders_workspace_request_nonce_unique" ON "video_renders" ("workspace_id","request_nonce");--> statement-breakpoint
CREATE INDEX "video_renders_workspace_project_index" ON "video_renders" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "video_renders_status_index" ON "video_renders" ("workspace_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_tenant_video_render_fkey" FOREIGN KEY ("video_render_id","project_id","workspace_id") REFERENCES "video_renders"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null));