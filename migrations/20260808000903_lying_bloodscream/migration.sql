CREATE TYPE "custom_voice_status" AS ENUM('active', 'revoked');--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'custom_voice_created';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'custom_voice_revoked';--> statement-breakpoint
CREATE TABLE "custom_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"provider_voice_id" text NOT NULL,
	"provider_consent_id" text NOT NULL,
	"consent_language" text NOT NULL,
	"status" "custom_voice_status" DEFAULT 'active'::"custom_voice_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"revoked_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_audio_generations" ADD COLUMN "is_custom_voice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_presets" ADD COLUMN "custom_voice_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_voices_id_workspace_unique" ON "custom_voices" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_voices_provider_voice_unique" ON "custom_voices" ("provider","provider_voice_id");--> statement-breakpoint
CREATE INDEX "custom_voices_workspace_status_index" ON "custom_voices" ("workspace_id","status","created_at");--> statement-breakpoint
ALTER TABLE "custom_voices" ADD CONSTRAINT "custom_voices_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_voices" ADD CONSTRAINT "custom_voices_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "custom_voices" ADD CONSTRAINT "custom_voices_revoked_by_user_id_users_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "voice_presets" ADD CONSTRAINT "voice_presets_tenant_custom_voice_fkey" FOREIGN KEY ("custom_voice_id","workspace_id") REFERENCES "custom_voices"("id","workspace_id") ON DELETE RESTRICT;