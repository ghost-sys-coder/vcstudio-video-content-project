CREATE TYPE "audio_generation_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "audio_output_format" AS ENUM('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm');--> statement-breakpoint
CREATE TYPE "audio_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "usage_operation_type" ADD VALUE 'scene_audio_generation';--> statement-breakpoint
CREATE TABLE "scene_audio_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"voice_preset_id" uuid NOT NULL,
	"generation_version" integer NOT NULL,
	"request_nonce" uuid NOT NULL,
	"status" "audio_generation_status" DEFAULT 'pending'::"audio_generation_status" NOT NULL,
	"review_status" "audio_review_status" DEFAULT 'pending'::"audio_review_status" NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"voice" text NOT NULL,
	"format" "audio_output_format" NOT NULL,
	"speed_scaled_percent" integer NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"sample_rate" integer,
	"input_text" text NOT NULL,
	"input_character_count" integer NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"asset_object_key" text,
	"asset_content_type" text,
	"asset_size_bytes" integer,
	"asset_etag" text,
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
	CONSTRAINT "scene_audio_generations_version_positive" CHECK ("generation_version" > 0),
	CONSTRAINT "scene_audio_generations_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0)),
	CONSTRAINT "scene_audio_generations_progress_range" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "scene_audio_generations_speed_range" CHECK ("speed_scaled_percent" between 25 and 400),
	CONSTRAINT "scene_audio_generations_duration_nonnegative" CHECK ("duration_milliseconds" is null or "duration_milliseconds" >= 0),
	CONSTRAINT "scene_audio_generations_input_characters_positive" CHECK ("input_character_count" > 0),
	CONSTRAINT "scene_audio_generations_approved_succeeded" CHECK ("review_status" <> 'approved' or "status" = 'succeeded')
);
--> statement-breakpoint
CREATE TABLE "voice_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text NOT NULL,
	"voice" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"speed_scaled_percent" integer DEFAULT 100 NOT NULL,
	"format" "audio_output_format" DEFAULT 'mp3'::"audio_output_format" NOT NULL,
	"sample_rate" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_presets_speed_range" CHECK ("speed_scaled_percent" between 25 and 400)
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "audio_generation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_id_workspace_unique" ON "scene_audio_generations" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_id_project_workspace_unique" ON "scene_audio_generations" ("id","project_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_idempotency_unique" ON "scene_audio_generations" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_version_unique" ON "scene_audio_generations" ("scene_version_id","generation_version");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_workspace_request_nonce_unique" ON "scene_audio_generations" ("workspace_id","request_nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_audio_generations_approved_scene_version_unique" ON "scene_audio_generations" ("scene_version_id") WHERE "review_status" = 'approved';--> statement-breakpoint
CREATE INDEX "scene_audio_generations_workspace_project_scene_index" ON "scene_audio_generations" ("workspace_id","project_id","scene_id","created_at");--> statement-breakpoint
CREATE INDEX "scene_audio_generations_status_index" ON "scene_audio_generations" ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_audio_generation_unique" ON "usage_reservations" ("audio_generation_id") WHERE "audio_generation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_presets_id_workspace_unique" ON "voice_presets" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_presets_workspace_slug_unique" ON "voice_presets" ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_presets_workspace_default_unique" ON "voice_presets" ("workspace_id") WHERE "is_default" = true and "archived_at" is null;--> statement-breakpoint
CREATE INDEX "voice_presets_workspace_index" ON "voice_presets" ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_tenant_scene_fkey" FOREIGN KEY ("scene_id","project_id","workspace_id") REFERENCES "scenes"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_tenant_version_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD CONSTRAINT "scene_audio_generations_tenant_voice_fkey" FOREIGN KEY ("voice_preset_id","workspace_id") REFERENCES "voice_presets"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_tenant_audio_generation_fkey" FOREIGN KEY ("audio_generation_id","project_id","workspace_id") REFERENCES "scene_audio_generations"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_presets" ADD CONSTRAINT "voice_presets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_presets" ADD CONSTRAINT "voice_presets_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_single_operation", ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type"::text = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null and "audio_generation_id" is null) or ("operation_type"::text = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null and "audio_generation_id" is null) or ("operation_type"::text = 'scene_audio_generation' and "analysis_run_id" is null and "image_generation_id" is null and "audio_generation_id" is not null));