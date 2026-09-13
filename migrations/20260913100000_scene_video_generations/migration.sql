DO $$ BEGIN
 CREATE TYPE "public"."scene_clip_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scene_clip_review_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scene_clip_mode" AS ENUM('image_to_video', 'text_to_video');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scene_video_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"output_variant_id" uuid,
	"source_image_generation_id" uuid,
	"mode" "public"."scene_clip_mode" DEFAULT 'image_to_video' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"resolution_height" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"loop_count" integer DEFAULT 1 NOT NULL,
	"trimmed" boolean DEFAULT false NOT NULL,
	"motion_description" text DEFAULT '' NOT NULL,
	"prompt_template_version_id" uuid,
	"prompt_template_version" text,
	"final_prompt" text,
	"generation_version" integer NOT NULL,
	"request_nonce" uuid NOT NULL,
	"status" "public"."scene_clip_status" DEFAULT 'pending' NOT NULL,
	"review_status" "public"."scene_clip_review_status" DEFAULT 'pending' NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text,
	"request_fingerprint" text,
	"provider_job_id" text,
	"provider_request_id" text,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"asset_object_key" text,
	"asset_content_type" text,
	"asset_size_bytes" integer,
	"asset_etag" text,
	"asset_width" integer,
	"asset_height" integer,
	"duration_milliseconds" integer,
	"error_category" text,
	"safe_error_message" text,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_video_generations_version_positive" CHECK ("scene_video_generations"."generation_version" > 0),
	CONSTRAINT "scene_video_generations_cost_nonnegative" CHECK ("scene_video_generations"."estimated_cost_cents" >= 0 and ("scene_video_generations"."actual_cost_cents" is null or "scene_video_generations"."actual_cost_cents" >= 0)),
	CONSTRAINT "scene_video_generations_progress_range" CHECK ("scene_video_generations"."progress_percent" between 0 and 100),
	CONSTRAINT "scene_video_generations_duration_positive" CHECK ("scene_video_generations"."duration_seconds" > 0),
	CONSTRAINT "scene_video_generations_loop_count_positive" CHECK ("scene_video_generations"."loop_count" > 0),
	CONSTRAINT "scene_video_generations_resolution_positive" CHECK ("scene_video_generations"."resolution_height" > 0),
	CONSTRAINT "scene_video_generations_aspect_ratio_supported" CHECK ("scene_video_generations"."aspect_ratio" in ('16:9', '9:16', '1:1')),
	CONSTRAINT "scene_video_generations_approved_succeeded" CHECK ("scene_video_generations"."review_status" <> 'approved' or "scene_video_generations"."status" = 'succeeded'),
	CONSTRAINT "scene_video_generations_mode_source_image" CHECK (("scene_video_generations"."mode" = 'image_to_video' and "scene_video_generations"."source_image_generation_id" is not null) or ("scene_video_generations"."mode" = 'text_to_video' and "scene_video_generations"."source_image_generation_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_id_workspace_unique" ON "scene_video_generations" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_id_project_workspace_unique" ON "scene_video_generations" USING btree ("id","project_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_idempotency_unique" ON "scene_video_generations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_version_unique" ON "scene_video_generations" USING btree ("scene_version_id","generation_version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_workspace_request_nonce_unique" ON "scene_video_generations" USING btree ("workspace_id","request_nonce");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scene_video_generations_approved_scene_version_variant_unique" ON "scene_video_generations" USING btree ("scene_version_id","output_variant_id") NULLS NOT DISTINCT WHERE "scene_video_generations"."review_status" = 'approved';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scene_video_generations_workspace_project_scene_index" ON "scene_video_generations" USING btree ("workspace_id","project_id","scene_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scene_video_generations_status_index" ON "scene_video_generations" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_prompt_template_version_id_fk" FOREIGN KEY ("prompt_template_version_id") REFERENCES "public"."prompt_template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_tenant_scene_fkey" FOREIGN KEY ("scene_id","project_id","workspace_id") REFERENCES "public"."scenes"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_tenant_scene_version_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "public"."scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_tenant_source_image_fkey" FOREIGN KEY ("source_image_generation_id","project_id","workspace_id") REFERENCES "public"."scene_image_generations"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_generations" ADD CONSTRAINT "scene_video_generations_tenant_output_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "public"."project_output_variants"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TYPE "public"."usage_operation_type" ADD VALUE IF NOT EXISTS 'scene_video_generation';--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN IF NOT EXISTS "clip_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT IF EXISTS "usage_reservations_single_operation";--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_single_operation" CHECK ((("usage_reservations"."operation_type"::text = 'scene_analysis' and "usage_reservations"."analysis_run_id" is not null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'scene_image_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is not null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'scene_audio_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is not null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'video_render' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is not null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'script_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is not null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'title_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is not null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'thumbnail_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is not null and "usage_reservations"."clip_generation_id" is null) or ("usage_reservations"."operation_type"::text = 'scene_video_generation' and "usage_reservations"."analysis_run_id" is null and "usage_reservations"."image_generation_id" is null and "usage_reservations"."audio_generation_id" is null and "usage_reservations"."video_render_id" is null and "usage_reservations"."script_generation_id" is null and "usage_reservations"."title_generation_id" is null and "usage_reservations"."thumbnail_generation_id" is null and "usage_reservations"."clip_generation_id" is not null)));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_reservations_clip_generation_unique" ON "usage_reservations" USING btree ("clip_generation_id") WHERE "usage_reservations"."clip_generation_id" is not null;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_tenant_clip_generation_fkey" FOREIGN KEY ("clip_generation_id","project_id","workspace_id") REFERENCES "public"."scene_video_generations"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;
