CREATE TYPE "format_preset_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "format_preset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"format_preset_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"audience_description" text DEFAULT '' NOT NULL,
	"editorial_structure" text DEFAULT '' NOT NULL,
	"target_duration_seconds" integer,
	"aspect_ratio" "project_aspect_ratio" NOT NULL,
	"frames_per_second" integer DEFAULT 30 NOT NULL,
	"voice_preset_id" uuid,
	"style_preset_id" uuid,
	"captions_enabled" boolean DEFAULT true NOT NULL,
	"default_maximum_budget_cents" integer,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "format_preset_versions_number_positive" CHECK ("version_number" > 0),
	CONSTRAINT "format_preset_versions_duration_positive" CHECK ("target_duration_seconds" is null or "target_duration_seconds" > 0),
	CONSTRAINT "format_preset_versions_budget_nonnegative" CHECK ("default_maximum_budget_cents" is null or "default_maximum_budget_cents" >= 0),
	CONSTRAINT "format_preset_versions_fps_valid" CHECK ("frames_per_second" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "format_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"channel_profile_id" uuid,
	"status" "format_preset_status" DEFAULT 'active'::"format_preset_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "format_presets_slug_present" CHECK (length("slug") > 0)
);
--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "channel_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "format_preset_id" uuid;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "planned_release_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "format_preset_version_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_content_idea_id" uuid;--> statement-breakpoint
CREATE INDEX "content_ideas_workspace_channel_index" ON "content_ideas" ("workspace_id","channel_profile_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "format_preset_versions_id_workspace_unique" ON "format_preset_versions" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "format_preset_versions_preset_number_unique" ON "format_preset_versions" ("format_preset_id","version_number");--> statement-breakpoint
CREATE INDEX "format_preset_versions_preset_index" ON "format_preset_versions" ("format_preset_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "format_presets_id_workspace_unique" ON "format_presets" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "format_presets_workspace_slug_unique" ON "format_presets" ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "format_presets_workspace_status_index" ON "format_presets" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_tenant_channel_fkey" FOREIGN KEY ("channel_profile_id","workspace_id") REFERENCES "channel_profiles"("id","workspace_id");--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_tenant_format_fkey" FOREIGN KEY ("format_preset_id","workspace_id") REFERENCES "format_presets"("id","workspace_id");--> statement-breakpoint
ALTER TABLE "format_preset_versions" ADD CONSTRAINT "format_preset_versions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "format_preset_versions" ADD CONSTRAINT "format_preset_versions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "format_preset_versions" ADD CONSTRAINT "format_preset_versions_tenant_preset_fkey" FOREIGN KEY ("format_preset_id","workspace_id") REFERENCES "format_presets"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "format_presets" ADD CONSTRAINT "format_presets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "format_presets" ADD CONSTRAINT "format_presets_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "format_presets" ADD CONSTRAINT "format_presets_tenant_channel_fkey" FOREIGN KEY ("channel_profile_id","workspace_id") REFERENCES "channel_profiles"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_content_idea_id_content_ideas_id_fkey" FOREIGN KEY ("source_content_idea_id") REFERENCES "content_ideas"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_format_version_fkey" FOREIGN KEY ("format_preset_version_id","workspace_id") REFERENCES "format_preset_versions"("id","workspace_id");