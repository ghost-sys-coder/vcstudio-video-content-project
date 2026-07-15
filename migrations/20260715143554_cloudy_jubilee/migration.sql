CREATE TYPE "storage_object_kind" AS ENUM('workspace_logo');--> statement-breakpoint
CREATE TABLE "storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"kind" "storage_object_kind" NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"etag" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "storage_objects_object_key_unique" ON "storage_objects" ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_objects_workspace_kind_unique" ON "storage_objects" ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "storage_objects_workspace_index" ON "storage_objects" ("workspace_id");--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;