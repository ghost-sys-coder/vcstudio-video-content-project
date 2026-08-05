CREATE TYPE "marketing_campaign_automation_status" AS ENUM('pending', 'researching', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "marketing_research_kind" AS ENUM('competitor', 'trend', 'keyword', 'audience');--> statement-breakpoint
CREATE TYPE "marketing_research_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "marketing_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"handles" jsonb DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_researched_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_research_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"kind" "marketing_research_kind" NOT NULL,
	"competitor_id" uuid,
	"topic" text NOT NULL,
	"queries" jsonb DEFAULT '[]' NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"provider_request_id" text,
	"status" "marketing_research_status" DEFAULT 'pending'::"marketing_research_status" NOT NULL,
	"result_document" jsonb,
	"citations" jsonb DEFAULT '[]' NOT NULL,
	"result_hash" text,
	"freshness_window_days" integer DEFAULT 7 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"run_id" uuid,
	"error_category" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_research_snapshots_competitor_kind" CHECK (("kind" = 'competitor') = ("competitor_id" is not null)),
	CONSTRAINT "marketing_research_snapshots_freshness_positive" CHECK ("freshness_window_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "automation_status" "marketing_campaign_automation_status" DEFAULT 'completed'::"marketing_campaign_automation_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "automation_status" SET DEFAULT 'pending'::"marketing_campaign_automation_status";--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "automation_trigger_run_id" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "automation_error" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "automation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "automation_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_competitors_id_workspace_unique" ON "marketing_competitors" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_competitors_active_website_unique" ON "marketing_competitors" ("workspace_id","website_url") WHERE "website_url" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "marketing_competitors_active_priority_index" ON "marketing_competitors" ("workspace_id","is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_research_snapshots_id_workspace_unique" ON "marketing_research_snapshots" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_research_snapshots_kind_created_index" ON "marketing_research_snapshots" ("workspace_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "marketing_research_snapshots_competitor_created_index" ON "marketing_research_snapshots" ("workspace_id","competitor_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_research_snapshots_expiry_index" ON "marketing_research_snapshots" ("workspace_id","expires_at");--> statement-breakpoint
ALTER TABLE "marketing_competitors" ADD CONSTRAINT "marketing_competitors_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_competitors" ADD CONSTRAINT "marketing_competitors_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_research_snapshots" ADD CONSTRAINT "marketing_research_snapshots_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_research_snapshots" ADD CONSTRAINT "marketing_research_snapshots_TH3imHM5lVtT_fkey" FOREIGN KEY ("run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_research_snapshots" ADD CONSTRAINT "marketing_research_snapshots_tenant_competitor_fkey" FOREIGN KEY ("competitor_id","workspace_id") REFERENCES "marketing_competitors"("id","workspace_id") ON DELETE CASCADE;
