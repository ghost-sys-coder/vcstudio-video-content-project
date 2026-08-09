CREATE TYPE "google_business_connection_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "google_business_sync_status" AS ENUM('never', 'syncing', 'succeeded', 'failed');--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'google_business_connected';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'google_business_synced';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'google_business_disconnected';--> statement-breakpoint
CREATE TABLE "google_business_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"access_token_sealed" text NOT NULL,
	"refresh_token_sealed" text,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"status" "google_business_connection_status" DEFAULT 'active'::"google_business_connection_status" NOT NULL,
	"sync_status" "google_business_sync_status" DEFAULT 'never'::"google_business_sync_status" NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_attempt_at" timestamp with time zone,
	"last_error" text,
	"connected_by_user_id" uuid NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_business_location_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"checksum" text NOT NULL,
	"profile_data" jsonb NOT NULL,
	"provider_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_business_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_name" text NOT NULL,
	"account_display_name" text DEFAULT '' NOT NULL,
	"location_name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"profile_data" jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_business_locations_primary_selected" CHECK (not "is_primary" or "selected")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_connections_workspace_unique" ON "google_business_connections" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_connections_id_workspace_unique" ON "google_business_connections" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "google_business_connections_sync_index" ON "google_business_connections" ("status","last_synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_location_snapshots_checksum_unique" ON "google_business_location_snapshots" ("workspace_id","location_id","checksum");--> statement-breakpoint
CREATE INDEX "google_business_location_snapshots_recent_index" ON "google_business_location_snapshots" ("workspace_id","location_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_locations_workspace_name_unique" ON "google_business_locations" ("workspace_id","location_name");--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_locations_id_workspace_unique" ON "google_business_locations" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_business_locations_primary_unique" ON "google_business_locations" ("workspace_id") WHERE "selected" and "is_primary";--> statement-breakpoint
CREATE INDEX "google_business_locations_selected_index" ON "google_business_locations" ("workspace_id","selected","title");--> statement-breakpoint
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_connected_by_user_id_users_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_business_location_snapshots" ADD CONSTRAINT "google_business_snapshots_tenant_connection_fkey" FOREIGN KEY ("connection_id","workspace_id") REFERENCES "google_business_connections"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "google_business_location_snapshots" ADD CONSTRAINT "google_business_snapshots_tenant_location_fkey" FOREIGN KEY ("location_id","workspace_id") REFERENCES "google_business_locations"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "google_business_locations" ADD CONSTRAINT "google_business_locations_tenant_connection_fkey" FOREIGN KEY ("connection_id","workspace_id") REFERENCES "google_business_connections"("id","workspace_id") ON DELETE CASCADE;