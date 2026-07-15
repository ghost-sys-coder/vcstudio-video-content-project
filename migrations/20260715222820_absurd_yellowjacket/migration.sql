ALTER TABLE "project_script_versions" ADD COLUMN "deleted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_script_versions" ADD CONSTRAINT "project_script_versions_deleted_by_user_id_users_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
