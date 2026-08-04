CREATE TYPE "marketing_onboarding_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TABLE "marketing_brand_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pain_points" jsonb DEFAULT '[]' NOT NULL,
	"geography" text DEFAULT '' NOT NULL,
	"buying_triggers" jsonb DEFAULT '[]' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_brand_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"handle" text DEFAULT '' NOT NULL,
	"cadence_per_week" integer DEFAULT 0 NOT NULL,
	"tone_override" text DEFAULT '' NOT NULL,
	"hashtag_strategy" text DEFAULT '' NOT NULL,
	"is_branded_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_brand_channels_cadence_range" CHECK ("cadence_per_week" >= 0 and "cadence_per_week" <= 50)
);
--> statement-breakpoint
CREATE TABLE "marketing_brand_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"price_model" text DEFAULT '' NOT NULL,
	"audience_id" uuid,
	"differentiators" jsonb DEFAULT '[]' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"business_name" text DEFAULT '' NOT NULL,
	"website_url" text,
	"one_liner" text DEFAULT '' NOT NULL,
	"long_description" text DEFAULT '' NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"primary_language" text DEFAULT 'English' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"brand_voice_summary" text DEFAULT '' NOT NULL,
	"tone_attributes" jsonb DEFAULT '[]' NOT NULL,
	"writing_rules" jsonb DEFAULT '[]' NOT NULL,
	"banned_phrases" jsonb DEFAULT '[]' NOT NULL,
	"value_props" jsonb DEFAULT '[]' NOT NULL,
	"proof_points" jsonb DEFAULT '[]' NOT NULL,
	"compliance_notes" text DEFAULT '' NOT NULL,
	"onboarding_status" "marketing_onboarding_status" DEFAULT 'not_started'::"marketing_onboarding_status" NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"context_version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_brand_profiles_context_version_positive" CHECK ("context_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "marketing_onboarding_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"answer_text" text DEFAULT '' NOT NULL,
	"answered_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "marketing_brand_audiences_profile_index" ON "marketing_brand_audiences" ("workspace_id","brand_profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_audiences_primary_unique" ON "marketing_brand_audiences" ("brand_profile_id") WHERE "is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_channels_workspace_platform_unique" ON "marketing_brand_channels" ("workspace_id","platform");--> statement-breakpoint
CREATE INDEX "marketing_brand_offers_profile_index" ON "marketing_brand_offers" ("workspace_id","brand_profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_profiles_workspace_unique" ON "marketing_brand_profiles" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_profiles_id_workspace_unique" ON "marketing_brand_profiles" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_onboarding_answers_workspace_question_unique" ON "marketing_onboarding_answers" ("workspace_id","question_key");--> statement-breakpoint
ALTER TABLE "marketing_brand_audiences" ADD CONSTRAINT "marketing_brand_audiences_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_audiences" ADD CONSTRAINT "marketing_brand_audiences_KAAww189PBgO_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "marketing_brand_profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_channels" ADD CONSTRAINT "marketing_brand_channels_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_offers" ADD CONSTRAINT "marketing_brand_offers_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_offers" ADD CONSTRAINT "marketing_brand_offers_3r72YZ4XcFvo_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "marketing_brand_profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_offers" ADD CONSTRAINT "marketing_brand_offers_JiQg1rSyLPzA_fkey" FOREIGN KEY ("audience_id") REFERENCES "marketing_brand_audiences"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_brand_profiles" ADD CONSTRAINT "marketing_brand_profiles_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_profiles" ADD CONSTRAINT "marketing_brand_profiles_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_onboarding_answers" ADD CONSTRAINT "marketing_onboarding_answers_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_onboarding_answers" ADD CONSTRAINT "marketing_onboarding_answers_answered_by_user_id_users_id_fkey" FOREIGN KEY ("answered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;