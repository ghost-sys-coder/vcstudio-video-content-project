CREATE TYPE "marketing_operation" AS ENUM('chat_turn', 'content_draft', 'ad_creative_copy', 'blog_post', 'email_draft', 'newsletter_draft', 'campaign_plan', 'media_story', 'document_summary', 'competitor_analysis', 'trend_scan', 'image_generation');--> statement-breakpoint
CREATE TYPE "marketing_reservation_status" AS ENUM('pending', 'reconciled', 'released');--> statement-breakpoint
CREATE TYPE "marketing_run_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "marketing_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"operation" "marketing_operation" NOT NULL,
	"status" "marketing_run_status" DEFAULT 'pending'::"marketing_run_status" NOT NULL,
	"subject_kind" text DEFAULT '' NOT NULL,
	"subject_id" uuid,
	"requested_by_user_id" uuid,
	"model" text DEFAULT '' NOT NULL,
	"prompt_version" text DEFAULT '' NOT NULL,
	"final_prompt" text DEFAULT '' NOT NULL,
	"request_fingerprint" text DEFAULT '' NOT NULL,
	"idempotency_key" text NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"trigger_run_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_category" text,
	"safe_error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_generation_runs_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
CREATE TABLE "marketing_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"operation" "marketing_operation" NOT NULL,
	"event_type" text NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"actual_cost_cents" integer DEFAULT 0 NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_usage_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"operation" "marketing_operation" NOT NULL,
	"status" "marketing_reservation_status" DEFAULT 'pending'::"marketing_reservation_status" NOT NULL,
	"reserved_cost_cents" integer NOT NULL,
	"actual_cost_cents" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_usage_reservations_cost_nonnegative" CHECK ("reserved_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_generation_runs_idempotency_unique" ON "marketing_generation_runs" ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_generation_runs_id_workspace_unique" ON "marketing_generation_runs" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_generation_runs_workspace_created_index" ON "marketing_generation_runs" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_generation_runs_status_index" ON "marketing_generation_runs" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_usage_events_reservation_type_unique" ON "marketing_usage_events" ("reservation_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_usage_reservations_run_unique" ON "marketing_usage_reservations" ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_usage_reservations_id_workspace_unique" ON "marketing_usage_reservations" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_usage_reservations_committed_index" ON "marketing_usage_reservations" ("workspace_id","created_at","status");--> statement-breakpoint
CREATE INDEX "marketing_usage_reservations_expiry_index" ON "marketing_usage_reservations" ("status","expires_at");--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD CONSTRAINT "marketing_generation_runs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_generation_runs" ADD CONSTRAINT "marketing_generation_runs_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_usage_events" ADD CONSTRAINT "marketing_usage_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_usage_events" ADD CONSTRAINT "marketing_usage_events_tenant_reservation_fkey" FOREIGN KEY ("reservation_id","workspace_id") REFERENCES "marketing_usage_reservations"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_usage_reservations" ADD CONSTRAINT "marketing_usage_reservations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_usage_reservations" ADD CONSTRAINT "marketing_usage_reservations_tenant_run_fkey" FOREIGN KEY ("run_id","workspace_id") REFERENCES "marketing_generation_runs"("id","workspace_id") ON DELETE CASCADE;