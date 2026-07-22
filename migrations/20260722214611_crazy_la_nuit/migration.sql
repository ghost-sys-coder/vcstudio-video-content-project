CREATE TYPE "short_composition_status" AS ENUM('draft', 'ready', 'archived');--> statement-breakpoint
CREATE TABLE "short_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"short_composition_id" uuid NOT NULL,
	"source_scene_id" uuid NOT NULL,
	"source_scene_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source_start_milliseconds" integer NOT NULL,
	"source_end_milliseconds" integer NOT NULL,
	"transition" text DEFAULT 'cut' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_clips_position_positive" CHECK ("position" > 0),
	CONSTRAINT "short_clips_range_valid" CHECK ("source_start_milliseconds" >= 0 and "source_end_milliseconds" > "source_start_milliseconds"),
	CONSTRAINT "short_clips_transition_supported" CHECK ("transition" in ('cut', 'fade'))
);
--> statement-breakpoint
CREATE TABLE "short_compositions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"output_variant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "short_composition_status" DEFAULT 'draft'::"short_composition_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_compositions_name_not_blank" CHECK (length(trim("name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "video_renders" ADD COLUMN "short_composition_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "short_clips_composition_position_unique" ON "short_clips" ("short_composition_id","position");--> statement-breakpoint
CREATE INDEX "short_clips_workspace_project_composition_index" ON "short_clips" ("workspace_id","project_id","short_composition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "short_compositions_id_workspace_unique" ON "short_compositions" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "short_compositions_workspace_project_index" ON "short_compositions" ("workspace_id","project_id","updated_at");--> statement-breakpoint
ALTER TABLE "short_clips" ADD CONSTRAINT "short_clips_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "short_clips" ADD CONSTRAINT "short_clips_tenant_composition_fkey" FOREIGN KEY ("short_composition_id","workspace_id") REFERENCES "short_compositions"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "short_clips" ADD CONSTRAINT "short_clips_tenant_scene_fkey" FOREIGN KEY ("source_scene_id","project_id","workspace_id") REFERENCES "scenes"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "short_clips" ADD CONSTRAINT "short_clips_tenant_scene_version_fkey" FOREIGN KEY ("source_scene_version_id","source_scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "short_compositions" ADD CONSTRAINT "short_compositions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "short_compositions" ADD CONSTRAINT "short_compositions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "short_compositions" ADD CONSTRAINT "short_compositions_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "short_compositions" ADD CONSTRAINT "short_compositions_tenant_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "project_output_variants"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_tenant_short_composition_fkey" FOREIGN KEY ("short_composition_id","workspace_id") REFERENCES "short_compositions"("id","workspace_id") ON DELETE RESTRICT;