ALTER TYPE "audit_action" ADD VALUE 'marketing_skill_deleted';--> statement-breakpoint
CREATE TABLE "marketing_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"base_skill_key" text NOT NULL,
	"input_fields" jsonb DEFAULT '[]' NOT NULL,
	"default_platform" "content_platform",
	"default_content_kind" "marketing_content_kind" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_skills_instructions_length" CHECK (char_length("instructions") <= 8000),
	CONSTRAINT "marketing_skills_input_fields_length" CHECK (jsonb_array_length("input_fields") <= 10),
	CONSTRAINT "marketing_skills_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_skills_id_workspace_unique" ON "marketing_skills" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_skills_workspace_slug_active_unique" ON "marketing_skills" ("workspace_id","slug") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "marketing_skills_workspace_enabled_index" ON "marketing_skills" ("workspace_id","is_enabled");--> statement-breakpoint
ALTER TABLE "marketing_skills" ADD CONSTRAINT "marketing_skills_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_skills" ADD CONSTRAINT "marketing_skills_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;