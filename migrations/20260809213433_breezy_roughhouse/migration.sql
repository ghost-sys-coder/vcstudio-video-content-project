CREATE TYPE "marketing_content_review_decision" AS ENUM('approved', 'changes_requested', 'archived');--> statement-breakpoint
CREATE TABLE "marketing_content_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"decision" "marketing_content_review_decision" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"reviewed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD COLUMN "skill_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD COLUMN "skill_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD COLUMN "brand_context_fingerprint" text DEFAULT '' NOT NULL;--> statement-breakpoint
INSERT INTO "marketing_content_review_events" (
	"workspace_id", "content_item_id", "decision", "reason",
	"reviewed_by_user_id", "created_at"
)
SELECT "workspace_id", "id", 'approved', "review_notes",
	"reviewed_by_user_id", "approved_at"
FROM "marketing_content_items"
WHERE "status" IN ('approved', 'scheduled', 'published')
	AND "approved_at" IS NOT NULL
	AND "reviewed_by_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "marketing_content_review_events_workspace_created_index" ON "marketing_content_review_events" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_content_review_events_item_created_index" ON "marketing_content_review_events" ("content_item_id","created_at");--> statement-breakpoint
ALTER TABLE "marketing_content_review_events" ADD CONSTRAINT "marketing_content_review_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_content_review_events" ADD CONSTRAINT "marketing_content_review_events_vAkkOGVx3dwq_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_content_review_events" ADD CONSTRAINT "marketing_content_review_events_tenant_item_fkey" FOREIGN KEY ("content_item_id","workspace_id") REFERENCES "marketing_content_items"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD CONSTRAINT "marketing_generation_runs_skill_version_positive" CHECK ("skill_version" > 0);
