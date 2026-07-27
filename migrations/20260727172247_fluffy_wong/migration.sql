ALTER TYPE "character_reference_type" ADD VALUE 'poseIdle';--> statement-breakpoint
ALTER TYPE "character_reference_type" ADD VALUE 'poseTalkOpen';--> statement-breakpoint
ALTER TYPE "character_reference_type" ADD VALUE 'poseTalkClosed';--> statement-breakpoint
ALTER TYPE "character_reference_type" ADD VALUE 'poseBlink';--> statement-breakpoint
CREATE TABLE "scene_animation_directions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "character_reference_assets_single_view_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_assets_single_view_unique" ON "character_reference_assets" ("character_id","type") WHERE "type" in ('master', 'front', 'threeQuarter', 'side', 'fullBody', 'poseIdle', 'poseTalkOpen', 'poseTalkClosed', 'poseBlink');--> statement-breakpoint
CREATE UNIQUE INDEX "scene_animation_directions_version_unique" ON "scene_animation_directions" ("scene_version_id");--> statement-breakpoint
CREATE INDEX "scene_animation_directions_workspace_project_index" ON "scene_animation_directions" ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "scene_animation_directions_character_index" ON "scene_animation_directions" ("character_id");--> statement-breakpoint
ALTER TABLE "scene_animation_directions" ADD CONSTRAINT "scene_animation_directions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_animation_directions" ADD CONSTRAINT "scene_animation_directions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_animation_directions" ADD CONSTRAINT "scene_animation_directions_UfEMvQrJmir7_fkey" FOREIGN KEY ("scene_version_id") REFERENCES "scene_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_animation_directions" ADD CONSTRAINT "scene_animation_directions_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_animation_directions" ADD CONSTRAINT "scene_animation_directions_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;