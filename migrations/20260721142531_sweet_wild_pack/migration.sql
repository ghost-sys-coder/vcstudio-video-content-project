CREATE TYPE "thumbnail_text_mode" AS ENUM('baked', 'clean');--> statement-breakpoint
ALTER TYPE "usage_operation_type" ADD VALUE 'thumbnail_generation';--> statement-breakpoint
CREATE TABLE "thumbnail_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"text_mode" "thumbnail_text_mode" NOT NULL,
	"headline_text" text,
	"script_version_id" uuid,
	"prompt_template_version_id" uuid NOT NULL,
	"prompt_template_version" text NOT NULL,
	"final_prompt" text NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"quality" "image_quality" NOT NULL,
	"size" text NOT NULL,
	"output_format" "image_output_format" NOT NULL,
	"output_compression" integer NOT NULL,
	"background" text DEFAULT 'opaque' NOT NULL,
	"status" "image_generation_status" DEFAULT 'pending'::"image_generation_status" NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"asset_object_key" text,
	"asset_content_type" text,
	"asset_size_bytes" integer,
	"asset_width" integer,
	"asset_height" integer,
	"asset_etag" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thumbnail_generations_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "thumbnail_generations_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0)),
	CONSTRAINT "thumbnail_generations_size_supported" CHECK ("size" in ('1536x1024', '1024x1536', '1024x1024')),
	CONSTRAINT "thumbnail_generations_headline_matches_text_mode" CHECK (("text_mode" = 'baked' and "headline_text" is not null and length(btrim("headline_text")) > 0) or ("text_mode" = 'clean' and "headline_text" is null))
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "thumbnail_generation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "thumbnail_generations_id_workspace_unique" ON "thumbnail_generations" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thumbnail_generations_idempotency_unique" ON "thumbnail_generations" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "thumbnail_generations_workspace_project_platform_index" ON "thumbnail_generations" ("workspace_id","project_id","platform","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_thumbnail_generation_unique" ON "usage_reservations" ("thumbnail_generation_id") WHERE "thumbnail_generation_id" is not null;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ADD CONSTRAINT "thumbnail_generations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ADD CONSTRAINT "thumbnail_generations_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ADD CONSTRAINT "thumbnail_generations_pdRjOdf6N3nJ_fkey" FOREIGN KEY ("script_version_id") REFERENCES "project_script_versions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ADD CONSTRAINT "thumbnail_generations_k6JpT9bV1Aud_fkey" FOREIGN KEY ("prompt_template_version_id") REFERENCES "prompt_template_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "thumbnail_generations" ADD CONSTRAINT "thumbnail_generations_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_78x2RRCC5uPU_fkey" FOREIGN KEY ("thumbnail_generation_id") REFERENCES "thumbnail_generations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'script_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is not null and "title_generation_id" is null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'title_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is not null and "thumbnail_generation_id" is null) or ("operation_type"::text = 'thumbnail_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is not null));