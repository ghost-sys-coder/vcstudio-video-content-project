CREATE TYPE "image_generation_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "image_output_format" AS ENUM('webp', 'png', 'jpeg');--> statement-breakpoint
CREATE TYPE "image_quality" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "image_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "provider_request_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "usage_event_type" AS ENUM('reserved', 'reconciled', 'released');--> statement-breakpoint
CREATE TYPE "usage_operation_type" AS ENUM('scene_analysis', 'scene_image_generation');--> statement-breakpoint
CREATE TABLE "generation_reference_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"generation_id" uuid NOT NULL,
	"reference_asset_id" uuid,
	"reference_asset_id_snapshot" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"object_key_snapshot" text NOT NULL,
	"content_type_snapshot" text NOT NULL,
	"etag_snapshot" text NOT NULL,
	"reference_type_snapshot" "character_reference_type" NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_reference_assets_position_positive" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prompt_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"template_key" text NOT NULL,
	"version" text NOT NULL,
	"source_hash" text NOT NULL,
	"template_source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"generation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "provider_request_status" DEFAULT 'pending'::"provider_request_status" NOT NULL,
	"provider_request_id" text,
	"idempotency_key" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"text_input_units" integer,
	"image_input_units" integer,
	"output_units" integer,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"error_code" text,
	"safe_error_message" text,
	"safe_metadata" jsonb DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_requests_units_nonnegative" CHECK (("text_input_units" is null or "text_input_units" >= 0) and ("image_input_units" is null or "image_input_units" >= 0) and ("output_units" is null or "output_units" >= 0)),
	CONSTRAINT "provider_requests_attempt_positive" CHECK ("attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "scene_image_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"style_preset_version_id" uuid NOT NULL,
	"prompt_template_version_id" uuid NOT NULL,
	"generation_version" integer NOT NULL,
	"request_nonce" uuid NOT NULL,
	"status" "image_generation_status" DEFAULT 'pending'::"image_generation_status" NOT NULL,
	"review_status" "image_review_status" DEFAULT 'pending'::"image_review_status" NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"quality" "image_quality" NOT NULL,
	"size" text NOT NULL,
	"output_format" "image_output_format" NOT NULL,
	"output_compression" integer NOT NULL,
	"input_fidelity" text,
	"prompt_template_version" text NOT NULL,
	"style_preset_version" integer NOT NULL,
	"final_prompt" text NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"asset_object_key" text,
	"asset_content_type" text,
	"asset_size_bytes" integer,
	"asset_width" integer,
	"asset_height" integer,
	"asset_etag" text,
	"error_category" text,
	"safe_error_message" text,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_image_generations_version_positive" CHECK ("generation_version" > 0),
	CONSTRAINT "scene_image_generations_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0)),
	CONSTRAINT "scene_image_generations_progress_range" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "scene_image_generations_compression_range" CHECK ("output_compression" between 1 and 100),
	CONSTRAINT "scene_image_generations_size_supported" CHECK ("size" in ('1536x1024', '1024x1536', '1024x1024')),
	CONSTRAINT "scene_image_generations_approved_succeeded" CHECK ("review_status" <> 'approved' or "status" = 'succeeded')
);
--> statement-breakpoint
CREATE TABLE "style_preset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"style_preset_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"positive_prompt" text NOT NULL,
	"negative_prompt" text NOT NULL,
	"default_aspect_ratio" "project_aspect_ratio" DEFAULT '16:9'::"project_aspect_ratio" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "style_preset_versions_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "style_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"operation_type" "usage_operation_type" NOT NULL,
	"event_type" "usage_event_type" NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"safe_metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "operation_type" "usage_operation_type" DEFAULT 'scene_analysis'::"usage_operation_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD COLUMN "image_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "usage_reservations" ALTER COLUMN "analysis_run_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "usage_reservations_analysis_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_analysis_unique" ON "usage_reservations" ("analysis_run_id") WHERE "analysis_run_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_reference_assets_generation_reference_unique" ON "generation_reference_assets" ("generation_id","reference_asset_id_snapshot");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_reference_assets_generation_position_unique" ON "generation_reference_assets" ("generation_id","position");--> statement-breakpoint
CREATE INDEX "generation_reference_assets_workspace_generation_index" ON "generation_reference_assets" ("workspace_id","generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_template_versions_key_version_unique" ON "prompt_template_versions" ("template_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_requests_generation_attempt_unique" ON "provider_requests" ("generation_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_requests_idempotency_unique" ON "provider_requests" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "provider_requests_workspace_status_index" ON "provider_requests" ("workspace_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_idempotency_unique" ON "scene_image_generations" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_version_unique" ON "scene_image_generations" ("scene_version_id","generation_version");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_workspace_request_nonce_unique" ON "scene_image_generations" ("workspace_id","request_nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_approved_scene_version_unique" ON "scene_image_generations" ("scene_version_id") WHERE "review_status" = 'approved';--> statement-breakpoint
CREATE INDEX "scene_image_generations_workspace_project_scene_index" ON "scene_image_generations" ("workspace_id","project_id","scene_id","created_at");--> statement-breakpoint
CREATE INDEX "scene_image_generations_status_index" ON "scene_image_generations" ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "style_preset_versions_preset_version_unique" ON "style_preset_versions" ("style_preset_id","version");--> statement-breakpoint
CREATE INDEX "style_preset_versions_workspace_preset_index" ON "style_preset_versions" ("workspace_id","style_preset_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "style_presets_workspace_slug_unique" ON "style_presets" ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "style_presets_workspace_default_unique" ON "style_presets" ("workspace_id") WHERE "is_default" = true and "archived_at" is null;--> statement-breakpoint
CREATE INDEX "style_presets_workspace_archived_index" ON "style_presets" ("workspace_id","archived_at","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_workspace_project_created_index" ON "usage_events" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_reservation_index" ON "usage_events" ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_image_generation_unique" ON "usage_reservations" ("image_generation_id") WHERE "image_generation_id" is not null;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_2TggRZ3uOpJQ_fkey" FOREIGN KEY ("generation_id") REFERENCES "scene_image_generations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_uUjGSTL48WQz_fkey" FOREIGN KEY ("reference_asset_id") REFERENCES "character_reference_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_generation_id_scene_image_generations_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "scene_image_generations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_scene_id_scenes_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_scene_version_id_scene_versions_id_fkey" FOREIGN KEY ("scene_version_id") REFERENCES "scene_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_2jglSAH7gK6N_fkey" FOREIGN KEY ("style_preset_version_id") REFERENCES "style_preset_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_30f2r2GnSvtr_fkey" FOREIGN KEY ("prompt_template_version_id") REFERENCES "prompt_template_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "style_preset_versions" ADD CONSTRAINT "style_preset_versions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_preset_versions" ADD CONSTRAINT "style_preset_versions_style_preset_id_style_presets_id_fkey" FOREIGN KEY ("style_preset_id") REFERENCES "style_presets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_preset_versions" ADD CONSTRAINT "style_preset_versions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "style_presets" ADD CONSTRAINT "style_presets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_presets" ADD CONSTRAINT "style_presets_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_reservation_id_usage_reservations_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "usage_reservations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_UfvakekGxwl3_fkey" FOREIGN KEY ("image_generation_id") REFERENCES "scene_image_generations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_single_operation" CHECK (("operation_type" = 'scene_analysis' and "analysis_run_id" is not null and "image_generation_id" is null) or ("operation_type" = 'scene_image_generation' and "analysis_run_id" is null and "image_generation_id" is not null));--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_cost_nonnegative", ADD CONSTRAINT "usage_reservations_cost_nonnegative" CHECK ("reserved_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0));
--> statement-breakpoint
INSERT INTO "prompt_template_versions" (
	"template_key",
	"version",
	"source_hash",
	"template_source"
) VALUES (
	'scene-image',
	'scene-image-v1',
	'090b20021aad93426915c8cd257c1c96478380e9bf88b503dcac83ce8d8800f5',
	E'VCStudio scene image prompt\nLayers: global style, character identity, character reference requirements,\nscene setting, scene action, camera composition, emotional tone, continuity,\nnegative constraints, output dimensions, aspect ratio, and text exclusion.'
) ON CONFLICT ("template_key", "version") DO NOTHING;
--> statement-breakpoint
WITH "seeded_presets" AS (
	INSERT INTO "style_presets" (
		"id",
		"workspace_id",
		"slug",
		"is_default",
		"created_by_user_id"
	)
	SELECT
		gen_random_uuid(),
		"workspaces"."id",
		'stick-figure-financial-education',
		true,
		"workspaces"."created_by_user_id"
	FROM "workspaces"
	WHERE NOT EXISTS (
		SELECT 1
		FROM "style_presets"
		WHERE "style_presets"."workspace_id" = "workspaces"."id"
			AND "style_presets"."slug" = 'stick-figure-financial-education'
	)
	RETURNING "id", "workspace_id", "created_by_user_id"
)
INSERT INTO "style_preset_versions" (
	"workspace_id",
	"style_preset_id",
	"version",
	"name",
	"description",
	"positive_prompt",
	"negative_prompt",
	"default_aspect_ratio",
	"created_by_user_id"
)
SELECT
	"workspace_id",
	"id",
	1,
	'Stick Figure Financial Education',
	'Clean, high-contrast financial education illustrations with consistent stick-figure characters and restrained editorial color.',
	'Minimal editorial stick-figure illustration, crisp dark linework, warm off-white background, restrained emerald and amber accents, clear visual hierarchy, expressive poses, polished educational explainer aesthetic, consistent character proportions, uncluttered composition.',
	'Photorealism, 3D rendering, gradients, visual noise, illegible labels, captions, logos, watermarks, extra limbs, malformed hands, inconsistent character proportions, cluttered background, low contrast.',
	'16:9',
	"created_by_user_id"
FROM "seeded_presets";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_used_style_preset_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "scene_image_generations"
		WHERE "style_preset_version_id" = OLD."id"
	) THEN
		RAISE EXCEPTION 'Used style preset versions are immutable.';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "style_preset_versions_immutable_when_used"
BEFORE UPDATE OR DELETE ON "style_preset_versions"
FOR EACH ROW
EXECUTE FUNCTION "protect_used_style_preset_version"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_prompt_template_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'Prompt template versions are immutable.';
	RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "prompt_template_versions_immutable"
BEFORE UPDATE OR DELETE ON "prompt_template_versions"
FOR EACH ROW
EXECUTE FUNCTION "protect_prompt_template_version"();
