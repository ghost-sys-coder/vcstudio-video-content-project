CREATE TABLE "activity_acknowledgements" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_key" text NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_acknowledgements_primary_key" PRIMARY KEY("workspace_id","user_id","activity_key")
);
--> statement-breakpoint
CREATE INDEX "activity_acknowledgements_user_index" ON "activity_acknowledgements" ("workspace_id","user_id","acknowledged_at");--> statement-breakpoint
ALTER TABLE "activity_acknowledgements" ADD CONSTRAINT "activity_acknowledgements_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_acknowledgements" ADD CONSTRAINT "activity_acknowledgements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
