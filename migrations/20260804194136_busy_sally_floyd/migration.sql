CREATE TYPE "marketing_tool_call_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "marketing_chat_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_call_id" text NOT NULL,
	"skill_key" text NOT NULL,
	"input" jsonb DEFAULT '{}' NOT NULL,
	"output" jsonb,
	"status" "marketing_tool_call_status" DEFAULT 'pending'::"marketing_tool_call_status" NOT NULL,
	"run_id" uuid,
	"trigger_run_id" text,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"actual_cost_cents" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_category" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_chat_tool_calls_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_chat_tool_calls_thread_call_unique" ON "marketing_chat_tool_calls" ("thread_id","tool_call_id");--> statement-breakpoint
CREATE INDEX "marketing_chat_tool_calls_status_index" ON "marketing_chat_tool_calls" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "marketing_chat_tool_calls" ADD CONSTRAINT "marketing_chat_tool_calls_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_chat_tool_calls" ADD CONSTRAINT "marketing_chat_tool_calls_3LeuFzgRtchv_fkey" FOREIGN KEY ("message_id") REFERENCES "marketing_chat_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_chat_tool_calls" ADD CONSTRAINT "marketing_chat_tool_calls_i6oDOEK9UGaR_fkey" FOREIGN KEY ("run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_chat_tool_calls" ADD CONSTRAINT "marketing_chat_tool_calls_tenant_thread_fkey" FOREIGN KEY ("thread_id","workspace_id") REFERENCES "marketing_chat_threads"("id","workspace_id") ON DELETE CASCADE;