CREATE TYPE "character_audit_action" AS ENUM('archived', 'referenceDeleted', 'referenceReplaced');--> statement-breakpoint
CREATE TYPE "character_reference_source" AS ENUM('uploaded', 'generated');--> statement-breakpoint
CREATE TYPE "character_reference_type" AS ENUM('master', 'front', 'threeQuarter', 'side', 'fullBody', 'expression', 'outfit', 'pose');--> statement-breakpoint
CREATE TYPE "character_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "character_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"reference_asset_id" uuid,
	"action" "character_audit_action" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_reference_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "character_reference_type" NOT NULL,
	"source" "character_reference_source" DEFAULT 'uploaded'::"character_reference_source" NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"etag" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_reference_assets_size_positive" CHECK ("size_bytes" > 0),
	CONSTRAINT "character_reference_assets_dimensions_positive" CHECK ("width" > 0 and "height" > 0)
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visual_identity" text DEFAULT '' NOT NULL,
	"body_proportions" text DEFAULT '' NOT NULL,
	"face_description" text DEFAULT '' NOT NULL,
	"hair_description" text DEFAULT '' NOT NULL,
	"skin_tone_description" text DEFAULT '' NOT NULL,
	"default_outfit_description" text DEFAULT '' NOT NULL,
	"personality_notes" text DEFAULT '' NOT NULL,
	"continuity_rules" text DEFAULT '' NOT NULL,
	"negative_constraints" text DEFAULT '' NOT NULL,
	"status" "character_status" DEFAULT 'draft'::"character_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_version_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "character_audit_events_workspace_character_index" ON "character_audit_events" ("workspace_id","character_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_assets_object_key_unique" ON "character_reference_assets" ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_assets_single_view_unique" ON "character_reference_assets" ("character_id","type") WHERE "type" in ('master', 'front', 'threeQuarter', 'side', 'fullBody');--> statement-breakpoint
CREATE INDEX "character_reference_assets_workspace_character_index" ON "character_reference_assets" ("workspace_id","character_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_workspace_slug_unique" ON "characters" ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "characters_workspace_status_updated_index" ON "characters" ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_version_characters_version_character_unique" ON "scene_version_characters" ("scene_version_id","character_id");--> statement-breakpoint
CREATE INDEX "scene_version_characters_workspace_project_index" ON "scene_version_characters" ("workspace_id","project_id","scene_version_id");--> statement-breakpoint
CREATE INDEX "scene_version_characters_character_index" ON "scene_version_characters" ("character_id");--> statement-breakpoint
ALTER TABLE "character_audit_events" ADD CONSTRAINT "character_audit_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_audit_events" ADD CONSTRAINT "character_audit_events_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_audit_events" ADD CONSTRAINT "character_audit_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "character_reference_assets" ADD CONSTRAINT "character_reference_assets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_reference_assets" ADD CONSTRAINT "character_reference_assets_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "character_reference_assets" ADD CONSTRAINT "character_reference_assets_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD CONSTRAINT "scene_version_characters_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD CONSTRAINT "scene_version_characters_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD CONSTRAINT "scene_version_characters_EacBCwd2s0i7_fkey" FOREIGN KEY ("scene_version_id") REFERENCES "scene_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD CONSTRAINT "scene_version_characters_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_version_characters" ADD CONSTRAINT "scene_version_characters_assigned_by_user_id_users_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;