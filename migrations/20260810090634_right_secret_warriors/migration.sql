CREATE TYPE "performance_metric_kind" AS ENUM('impressions', 'views', 'watch_time', 'retention', 'engagement', 'clicks', 'conversions');--> statement-breakpoint
CREATE TYPE "performance_metric_unit" AS ENUM('count', 'milliseconds', 'ratio');--> statement-breakpoint
CREATE TYPE "performance_sync_status" AS ENUM('pending', 'ready', 'unsupported', 'permission_required', 'rate_limited', 'failed');--> statement-breakpoint
CREATE TABLE "publication_metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"metric_kind" "performance_metric_kind" NOT NULL,
	"unit" "performance_metric_unit" NOT NULL,
	"normalized_value" numeric(24,6) NOT NULL,
	"raw_metric_key" text NOT NULL,
	"raw_value" text NOT NULL,
	"provider_definition" text NOT NULL,
	"provider_definition_version" text NOT NULL,
	"comparable_group" text,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_metric_observations_value_nonnegative" CHECK ("normalized_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "publication_performance_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"publication_kind" text NOT NULL,
	"social_post_target_id" uuid,
	"video_publication_id" uuid,
	"connection_id" uuid,
	"platform" "content_platform" NOT NULL,
	"provider_publication_id" text NOT NULL,
	"provider_definition_version" text NOT NULL,
	"cursor" text,
	"sync_status" "performance_sync_status" DEFAULT 'pending'::"performance_sync_status" NOT NULL,
	"next_sync_at" timestamp with time zone,
	"backoff_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"safe_error_message" text,
	"last_synced_at" timestamp with time zone,
	"attribution" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_performance_sources_kind_target_valid" CHECK (("publication_kind" = 'social_post_target' and "social_post_target_id" is not null and "video_publication_id" is null) or ("publication_kind" = 'video_publication' and "video_publication_id" is not null and "social_post_target_id" is null)),
	CONSTRAINT "publication_performance_sources_attempt_nonnegative" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "publication_metric_observations_identity_unique" ON "publication_metric_observations" ("source_id","raw_metric_key","provider_definition_version","observed_at");--> statement-breakpoint
CREATE INDEX "publication_metric_observations_workspace_kind_index" ON "publication_metric_observations" ("workspace_id","metric_kind","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_performance_sources_id_workspace_unique" ON "publication_performance_sources" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_performance_sources_social_unique" ON "publication_performance_sources" ("social_post_target_id") WHERE "social_post_target_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_performance_sources_video_unique" ON "publication_performance_sources" ("video_publication_id") WHERE "video_publication_id" is not null;--> statement-breakpoint
CREATE INDEX "publication_performance_sources_due_index" ON "publication_performance_sources" ("sync_status","next_sync_at");--> statement-breakpoint
CREATE INDEX "publication_performance_sources_workspace_index" ON "publication_performance_sources" ("workspace_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "social_post_targets_id_workspace_unique" ON "social_post_targets" ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "publication_metric_observations" ADD CONSTRAINT "publication_metric_observations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "publication_metric_observations" ADD CONSTRAINT "publication_metric_observations_tenant_source_fkey" FOREIGN KEY ("source_id","workspace_id") REFERENCES "publication_performance_sources"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "publication_performance_sources" ADD CONSTRAINT "publication_performance_sources_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "publication_performance_sources" ADD CONSTRAINT "publication_performance_sources_tenant_social_target_fkey" FOREIGN KEY ("social_post_target_id","workspace_id") REFERENCES "social_post_targets"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "publication_performance_sources" ADD CONSTRAINT "publication_performance_sources_tenant_video_publication_fkey" FOREIGN KEY ("video_publication_id","workspace_id") REFERENCES "video_publications"("id","workspace_id") ON DELETE CASCADE;