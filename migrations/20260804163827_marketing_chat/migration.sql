CREATE TYPE "marketing_chat_message_status" AS ENUM('streaming', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "marketing_chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "marketing_thread_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "marketing_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" "marketing_chat_role" NOT NULL,
	"parts" jsonb DEFAULT '[]' NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"request_nonce" uuid,
	"model_id" text DEFAULT '' NOT NULL,
	"prompt_version" text DEFAULT '' NOT NULL,
	"brand_context_snapshot_id" uuid,
	"run_id" uuid,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"status" "marketing_chat_message_status" DEFAULT 'complete'::"marketing_chat_message_status" NOT NULL,
	"finish_reason" text DEFAULT '' NOT NULL,
	"provider_request_id" text,
	"safe_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_chat_messages_position_nonnegative" CHECK ("position" >= 0),
	CONSTRAINT "marketing_chat_messages_cost_nonnegative" CHECK ("cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "marketing_chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"status" "marketing_thread_status" DEFAULT 'active'::"marketing_thread_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_chat_threads_counts_nonnegative" CHECK ("message_count" >= 0 and "total_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_chat_messages_position_unique" ON "marketing_chat_messages" ("thread_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_chat_messages_nonce_unique" ON "marketing_chat_messages" ("thread_id","request_nonce") WHERE "request_nonce" is not null;--> statement-breakpoint
CREATE INDEX "marketing_chat_messages_thread_index" ON "marketing_chat_messages" ("thread_id","position");--> statement-breakpoint
CREATE INDEX "marketing_chat_messages_status_index" ON "marketing_chat_messages" ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "marketing_chat_threads_recent_index" ON "marketing_chat_threads" ("workspace_id","status","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_chat_threads_id_workspace_unique" ON "marketing_chat_threads" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_knowledge_documents_fts_index" ON "marketing_knowledge_documents" USING gin (to_tsvector('english', "extracted_text"));--> statement-breakpoint
ALTER TABLE "marketing_chat_messages" ADD CONSTRAINT "marketing_chat_messages_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_chat_messages" ADD CONSTRAINT "marketing_chat_messages_UeXyajgt4TQc_fkey" FOREIGN KEY ("brand_context_snapshot_id") REFERENCES "marketing_brand_context_snapshots"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_chat_messages" ADD CONSTRAINT "marketing_chat_messages_FWSNiFsQNmsV_fkey" FOREIGN KEY ("run_id") REFERENCES "marketing_generation_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_chat_messages" ADD CONSTRAINT "marketing_chat_messages_tenant_thread_fkey" FOREIGN KEY ("thread_id","workspace_id") REFERENCES "marketing_chat_threads"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_chat_threads" ADD CONSTRAINT "marketing_chat_threads_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_chat_threads" ADD CONSTRAINT "marketing_chat_threads_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;