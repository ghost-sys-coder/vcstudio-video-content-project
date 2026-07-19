CREATE TABLE "project_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_characters_project_character_unique" ON "project_characters" ("project_id","character_id");--> statement-breakpoint
CREATE INDEX "project_characters_workspace_project_index" ON "project_characters" ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_characters_character_index" ON "project_characters" ("character_id");--> statement-breakpoint
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_character_id_characters_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_added_by_user_id_users_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;