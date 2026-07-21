CREATE TYPE "platform_connection_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "publication_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TYPE "video_publication_status" AS ENUM('pending', 'queued', 'uploading', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"external_account_id" text NOT NULL,
	"external_account_name" text DEFAULT '' NOT NULL,
	"external_account_url" text,
	"access_token_sealed" text NOT NULL,
	"refresh_token_sealed" text,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"status" "platform_connection_status" DEFAULT 'active'::"platform_connection_status" NOT NULL,
	"last_error" text,
	"connected_by_user_id" uuid NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"render_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"visibility" "publication_visibility" DEFAULT 'private'::"publication_visibility" NOT NULL,
	"status" "video_publication_status" DEFAULT 'pending'::"video_publication_status" NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"trigger_run_id" text,
	"idempotency_key" text NOT NULL,
	"external_video_id" text,
	"external_video_url" text,
	"uploaded_bytes" integer,
	"error_category" text,
	"safe_error_message" text,
	"requested_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_publications_progress_valid" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "video_publications_title_present" CHECK (length("title") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_id_workspace_unique" ON "platform_connections" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_workspace_account_unique" ON "platform_connections" ("workspace_id","platform","external_account_id");--> statement-breakpoint
CREATE INDEX "platform_connections_workspace_platform_index" ON "platform_connections" ("workspace_id","platform","status");--> statement-breakpoint
CREATE UNIQUE INDEX "video_publications_id_workspace_unique" ON "video_publications" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_publications_idempotency_unique" ON "video_publications" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "video_publications_workspace_project_index" ON "video_publications" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "video_publications_render_index" ON "video_publications" ("render_id");--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_connected_by_user_id_users_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_connection_id_platform_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_tenant_render_fkey" FOREIGN KEY ("render_id","project_id","workspace_id") REFERENCES "video_renders"("id","project_id","workspace_id") ON DELETE CASCADE;