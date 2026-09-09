CREATE TYPE "channel_cadence" AS ENUM('weekly', 'biweekly', 'monthly', 'irregular');--> statement-breakpoint
CREATE TYPE "channel_profile_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "channel_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"audience_description" text DEFAULT '' NOT NULL,
	"tone_description" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"cadence" "channel_cadence" DEFAULT 'weekly'::"channel_cadence" NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"default_aspect_ratio" "project_aspect_ratio",
	"default_maximum_budget_cents" integer,
	"external_account_id" text,
	"status" "channel_profile_status" DEFAULT 'active'::"channel_profile_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_profiles_budget_nonnegative" CHECK ("default_maximum_budget_cents" is null or "default_maximum_budget_cents" >= 0),
	CONSTRAINT "channel_profiles_slug_present" CHECK (length("slug") > 0)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "channel_profile_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_profiles_id_workspace_unique" ON "channel_profiles" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_profiles_workspace_slug_unique" ON "channel_profiles" ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "channel_profiles_workspace_platform_index" ON "channel_profiles" ("workspace_id","platform","status");--> statement-breakpoint
CREATE INDEX "channel_profiles_workspace_account_index" ON "channel_profiles" ("workspace_id","platform","external_account_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_channel_index" ON "projects" ("workspace_id","channel_profile_id","updated_at");--> statement-breakpoint
ALTER TABLE "channel_profiles" ADD CONSTRAINT "channel_profiles_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "channel_profiles" ADD CONSTRAINT "channel_profiles_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_channel_profile_fkey" FOREIGN KEY ("channel_profile_id","workspace_id") REFERENCES "channel_profiles"("id","workspace_id") ON DELETE CASCADE;