CREATE TYPE "marketing_schedule_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "marketing_schedule_run_status" AS ENUM('claimed', 'running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "marketing_schedule_rule_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "marketing_schedule_run_status" DEFAULT 'claimed'::"marketing_schedule_run_status" NOT NULL,
	"skip_reason" text,
	"created_content_item_ids" jsonb DEFAULT '[]' NOT NULL,
	"run_id" uuid,
	"trigger_run_id" text,
	"error_category" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"campaign_id" uuid,
	"skill_key" text NOT NULL,
	"content_kind" "marketing_content_kind" NOT NULL,
	"platforms" jsonb DEFAULT '[]' NOT NULL,
	"traffic_type" "marketing_traffic_type" DEFAULT 'organic'::"marketing_traffic_type" NOT NULL,
	"is_branded" boolean DEFAULT true NOT NULL,
	"prompt_brief" text NOT NULL,
	"frequency" "marketing_schedule_frequency" NOT NULL,
	"by_weekday" jsonb DEFAULT '[]' NOT NULL,
	"by_month_day" integer,
	"time_of_day_minutes" integer NOT NULL,
	"timezone" text NOT NULL,
	"lead_time_minutes" integer DEFAULT 1440 NOT NULL,
	"max_items_per_run" integer DEFAULT 1 NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"auto_schedule" boolean DEFAULT true NOT NULL,
	"monthly_budget_cents" integer,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"consecutive_failure_count" integer DEFAULT 0 NOT NULL,
	"paused_reason" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_schedule_rules_time_valid" CHECK ("time_of_day_minutes" between 0 and 1439),
	CONSTRAINT "marketing_schedule_rules_items_valid" CHECK ("max_items_per_run" between 1 and 10),
	CONSTRAINT "marketing_schedule_rules_month_day_valid" CHECK ("frequency" <> 'monthly' or "by_month_day" between 1 and 28),
	CONSTRAINT "marketing_schedule_rules_lead_time_valid" CHECK ("lead_time_minutes" between 0 and 43200),
	CONSTRAINT "marketing_schedule_rules_budget_valid" CHECK ("monthly_budget_cents" is null or "monthly_budget_cents" >= 0),
	CONSTRAINT "marketing_schedule_rules_failure_count_valid" CHECK ("consecutive_failure_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_schedule_rule_runs_occurrence_unique" ON "marketing_schedule_rule_runs" ("rule_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_schedule_rule_runs_id_workspace_unique" ON "marketing_schedule_rule_runs" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_schedule_rule_runs_workspace_created_index" ON "marketing_schedule_rule_runs" ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_schedule_rules_id_workspace_unique" ON "marketing_schedule_rules" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_schedule_rules_due_index" ON "marketing_schedule_rules" ("is_enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "marketing_schedule_rules_workspace_enabled_index" ON "marketing_schedule_rules" ("workspace_id","is_enabled");--> statement-breakpoint
ALTER TABLE "marketing_schedule_rule_runs" ADD CONSTRAINT "marketing_schedule_rule_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_schedule_rule_runs" ADD CONSTRAINT "marketing_schedule_rule_runs_wmchQOf3Pu9n_fkey" FOREIGN KEY ("run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_schedule_rule_runs" ADD CONSTRAINT "marketing_schedule_rule_runs_tenant_rule_fkey" FOREIGN KEY ("rule_id","workspace_id") REFERENCES "marketing_schedule_rules"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_schedule_rules" ADD CONSTRAINT "marketing_schedule_rules_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_schedule_rules" ADD CONSTRAINT "marketing_schedule_rules_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_schedule_rules" ADD CONSTRAINT "marketing_schedule_rules_tenant_campaign_fkey" FOREIGN KEY ("campaign_id","workspace_id") REFERENCES "marketing_campaigns"("id","workspace_id") ON DELETE RESTRICT;