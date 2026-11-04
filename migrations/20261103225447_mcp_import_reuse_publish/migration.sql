
CREATE TABLE "mcp_asset_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"scene_image_id" uuid,
	"attribution" text DEFAULT '' NOT NULL,
	"source_host" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"sealed_source" text,
	"approval_hash" text,
	"trigger_run_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_operations_status_valid" CHECK ("status" in ('awaiting_upload','requires_approval','queued','running','approved','succeeded','failed','cancelled','expired'))
);
--> statement-breakpoint
CREATE TABLE "mcp_workspace_grants" (
	"connection_id" uuid,
	"workspace_id" uuid,
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_workspace_grants_pkey" PRIMARY KEY("connection_id","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "mcp_operation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_asset_origins_operation_unique" ON "mcp_asset_origins" ("operation_id");--> statement-breakpoint
CREATE INDEX "mcp_asset_origins_asset_index" ON "mcp_asset_origins" ("workspace_id","media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_user_client_unique" ON "mcp_connections" ("user_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_operations_request_unique" ON "mcp_operations" ("connection_id","workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_operations_id_workspace_unique" ON "mcp_operations" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "mcp_operations_recovery_index" ON "mcp_operations" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "mcp_operations_workspace_created_index" ON "mcp_operations" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_grants_workspace_index" ON "mcp_workspace_grants" ("workspace_id");--> statement-breakpoint
ALTER TABLE "mcp_asset_origins" ADD CONSTRAINT "mcp_asset_origins_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_asset_origins" ADD CONSTRAINT "mcp_asset_origins_d8HtP8BIIebb_fkey" FOREIGN KEY ("operation_id","workspace_id") REFERENCES "mcp_operations"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_asset_origins" ADD CONSTRAINT "mcp_asset_origins_NR8fkss7wYPg_fkey" FOREIGN KEY ("media_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_asset_origins" ADD CONSTRAINT "mcp_asset_origins_LLSyoABP9mzJ_fkey" FOREIGN KEY ("scene_image_id","workspace_id") REFERENCES "scene_image_generations"("id","workspace_id");--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_operations" ADD CONSTRAINT "mcp_operations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_operations" ADD CONSTRAINT "mcp_operations_connection_id_mcp_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mcp_connections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_operations" ADD CONSTRAINT "mcp_operations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_operations" ADD CONSTRAINT "mcp_operations_LgGI4Mogdnwm_fkey" FOREIGN KEY ("connection_id","workspace_id") REFERENCES "mcp_workspace_grants"("connection_id","workspace_id");--> statement-breakpoint
ALTER TABLE "mcp_workspace_grants" ADD CONSTRAINT "mcp_workspace_grants_connection_id_mcp_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mcp_connections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_workspace_grants" ADD CONSTRAINT "mcp_workspace_grants_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_mcp_operation_id_mcp_operations_id_fkey" FOREIGN KEY ("mcp_operation_id") REFERENCES "mcp_operations"("id");
