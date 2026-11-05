ALTER TYPE "usage_operation_type" ADD VALUE 'video_generation' BEFORE 'scene_analysis';--> statement-breakpoint
CREATE TABLE "scene_visual_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"kind" text DEFAULT 'inherit' NOT NULL,
	"source_asset_id" uuid,
	"object_key" text,
	"width" integer,
	"height" integer,
	"duration_milliseconds" integer,
	"fit" text DEFAULT 'contain' NOT NULL,
	"trim_start_milliseconds" integer DEFAULT 0 NOT NULL,
	"loop" boolean DEFAULT false NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_visual_selections_values_valid" CHECK ("kind" in ('inherit','image','video') and "fit" in ('contain','cover') and "review_status" in ('pending','approved','rejected') and "revision">0 and "trim_start_milliseconds">=0),
	CONSTRAINT "scene_visual_selections_media_valid" CHECK ((("object_key" is null and "source_asset_id" is null and "kind"<>'video') or ("kind"='video' and "object_key" is not null and "source_asset_id" is not null and "width">0 and "height">0 and "duration_milliseconds">0)) is true)
);
--> statement-breakpoint
CREATE TABLE "video_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"scene_id" uuid,
	"scene_version_id" uuid,
	"requested_by_user_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"request" jsonb NOT NULL,
	"model_snapshot" jsonb NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"input_assets" jsonb DEFAULT '[]' NOT NULL,
	"final_prompt" text NOT NULL,
	"prompt_template_version" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_job_id" text,
	"provider_request_id" text,
	"encrypted_output" text,
	"trigger_run_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"input_units" integer,
	"output_units" integer,
	"output_asset_id" uuid,
	"error_code" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_generations_status_valid" CHECK ("status" in ('queued','submitting','running','inspecting','succeeded','failed','cancelled','requires_reconciliation')),
	CONSTRAINT "video_generations_cost_valid" CHECK ("estimated_cost_cents">0 and ("actual_cost_cents" is null or "actual_cost_cents">=0) and "attempt_count" between 0 and 1),
	CONSTRAINT "video_generations_target_valid" CHECK ((("project_id" is null and "scene_id" is null and "scene_version_id" is null and "request"->'target'->>'kind'='direct') or ("project_id" is not null and "scene_id" is not null and "scene_version_id" is not null and "request"->'target'->>'kind'='scene')) is true)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_visual_media" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "video_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_reservations" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_visual_selections_version_revision_unique" ON "scene_visual_selections" ("scene_version_id","workspace_id","revision");--> statement-breakpoint
CREATE INDEX "scene_visual_selections_project_index" ON "scene_visual_selections" ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_id_workspace_unique" ON "usage_reservations" ("id","workspace_id","operation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_video_generation_unique" ON "usage_reservations" ("video_generation_id") WHERE "video_generation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_id_workspace_unique" ON "video_generations" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_workspace_idempotency_unique" ON "video_generations" ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_quote_unique" ON "video_generations" ("quote_id");--> statement-breakpoint
CREATE INDEX "video_generations_workspace_created_index" ON "video_generations" ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "video_generations_workspace_status_index" ON "video_generations" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "scene_visual_selections" ADD CONSTRAINT "scene_visual_selections_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_visual_selections" ADD CONSTRAINT "scene_visual_selections_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_visual_selections" ADD CONSTRAINT "scene_visual_selections_scene_tenant_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_visual_selections" ADD CONSTRAINT "scene_visual_selections_asset_tenant_fkey" FOREIGN KEY ("source_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id");--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_reservation_workspace_fkey" FOREIGN KEY ("reservation_id","workspace_id","operation_type") REFERENCES "usage_reservations"("id","workspace_id","operation_type") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_video_generation_tenant_fkey" FOREIGN KEY ("video_generation_id","workspace_id") REFERENCES "video_generations"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_project_tenant_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_scene_tenant_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_asset_tenant_fkey" FOREIGN KEY ("output_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_visual_media_valid" CHECK ("default_visual_media" in ('image','video'));--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (((("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'video_render' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is not null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'script_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is not null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'title_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is not null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'thumbnail_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is not null and "clip_generation_id" is null and "chapter_generation_id" is null) or ("operation_type"::text = 'scene_video_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is not null and "chapter_generation_id" is null) or ("operation_type"::text = 'chapter_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is null and "video_render_id" is null and "script_generation_id" is null and "title_generation_id" is null and "thumbnail_generation_id" is null and "clip_generation_id" is null and "chapter_generation_id" is not null)) and "video_generation_id" is null and "project_id" is not null) or ("operation_type"::text = 'video_generation' and "video_generation_id" is not null and num_nonnulls("analysis_run_id", "image_generation_id", "audio_generation_id", "video_render_id", "script_generation_id", "title_generation_id", "thumbnail_generation_id", "clip_generation_id", "chapter_generation_id") = 0));