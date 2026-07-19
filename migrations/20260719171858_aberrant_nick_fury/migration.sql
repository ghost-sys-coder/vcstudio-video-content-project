CREATE TYPE "character_reference_generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "character_reference_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"reference_type" "character_reference_type" NOT NULL,
	"status" "character_reference_generation_status" DEFAULT 'queued'::"character_reference_generation_status" NOT NULL,
	"model" text NOT NULL,
	"size" text NOT NULL,
	"quality" text NOT NULL,
	"output_format" text NOT NULL,
	"output_compression" integer NOT NULL,
	"background" text NOT NULL,
	"final_prompt" text NOT NULL,
	"prompt_template_version" text NOT NULL,
	"prompt_template_version_id" uuid NOT NULL,
	"request_nonce" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"result_reference_asset_id" uuid,
	"provider_request_id" text,
	"trigger_run_id" text,
	"safe_error_message" text,
	"requested_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_reference_generations_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0)),
	CONSTRAINT "character_reference_generations_progress_range" CHECK ("progress_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_generations_idempotency_unique" ON "character_reference_generations" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_generations_workspace_nonce_unique" ON "character_reference_generations" ("workspace_id","request_nonce");--> statement-breakpoint
CREATE INDEX "character_reference_generations_character_index" ON "character_reference_generations" ("workspace_id","character_id","created_at");--> statement-breakpoint
CREATE INDEX "character_reference_generations_status_index" ON "character_reference_generations" ("workspace_id","status","created_at");--> statement-breakpoint
ALTER TABLE "character_reference_generations" ADD CONSTRAINT "character_reference_generations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_reference_generations" ADD CONSTRAINT "character_reference_generations_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_reference_generations" ADD CONSTRAINT "character_reference_generations_Am2O8f0QStzu_fkey" FOREIGN KEY ("prompt_template_version_id") REFERENCES "prompt_template_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "character_reference_generations" ADD CONSTRAINT "character_reference_generations_u5o2drs6ms2p_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
INSERT INTO "prompt_template_versions" (
	"template_key",
	"version",
	"source_hash",
	"template_source"
) VALUES (
	'character-reference',
	'character-reference-v1',
	'ce418585988fd5824d4d947daf9f839807d165611b844e16f8a8054b760bcc1e',
	E'VCStudio character reference portrait prompt\nLayers: global portrait framing, character identity, face, hair, skin tone,\nbody proportions, default outfit, requested reference view, negative\nconstraints, output dimensions, and text exclusion.'
) ON CONFLICT ("template_key", "version") DO NOTHING;