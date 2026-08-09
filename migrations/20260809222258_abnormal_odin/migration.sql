CREATE TYPE "marketing_weekly_digest_status" AS ENUM('generating', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "marketing_weekly_digest_acknowledgements" (
	"workspace_id" uuid NOT NULL,
	"digest_id" uuid,
	"user_id" uuid,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_weekly_digest_acknowledgements_pkey" PRIMARY KEY("digest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "marketing_weekly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"status" "marketing_weekly_digest_status" DEFAULT 'generating'::"marketing_weekly_digest_status" NOT NULL,
	"snapshot" jsonb,
	"trigger_run_id" text,
	"error_category" text,
	"safe_error_message" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_weekly_digests_date_order" CHECK ("week_end" > "week_start")
);
--> statement-breakpoint
CREATE INDEX "marketing_weekly_digest_ack_workspace_user_index" ON "marketing_weekly_digest_acknowledgements" ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_weekly_digests_workspace_week_unique" ON "marketing_weekly_digests" ("workspace_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_weekly_digests_id_workspace_unique" ON "marketing_weekly_digests" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_weekly_digests_workspace_created_index" ON "marketing_weekly_digests" ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "marketing_weekly_digest_acknowledgements" ADD CONSTRAINT "marketing_weekly_digest_acknowledgements_Lc4sTbPhgLze_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_weekly_digest_acknowledgements" ADD CONSTRAINT "marketing_weekly_digest_acknowledgements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_weekly_digest_acknowledgements" ADD CONSTRAINT "marketing_weekly_digest_ack_tenant_digest_fkey" FOREIGN KEY ("digest_id","workspace_id") REFERENCES "marketing_weekly_digests"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_weekly_digests" ADD CONSTRAINT "marketing_weekly_digests_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;