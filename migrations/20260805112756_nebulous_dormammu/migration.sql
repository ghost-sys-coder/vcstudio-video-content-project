CREATE TYPE "marketing_campaign_objective" AS ENUM('awareness', 'traffic', 'leads', 'sales', 'retention', 'hiring');--> statement-breakpoint
CREATE TYPE "marketing_campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" "marketing_campaign_objective" NOT NULL,
	"traffic_type" "marketing_traffic_type" NOT NULL,
	"status" "marketing_campaign_status" DEFAULT 'draft'::"marketing_campaign_status" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"audience_id" uuid,
	"offer_id" uuid,
	"key_message" text DEFAULT '' NOT NULL,
	"hypothesis" text DEFAULT '' NOT NULL,
	"platforms" jsonb DEFAULT '[]' NOT NULL,
	"brief_document" jsonb DEFAULT '{"type":"doc","content":[]}' NOT NULL,
	"brief_plain_text" text DEFAULT '' NOT NULL,
	"is_branded" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_campaigns_date_order" CHECK ("end_date" is null or "end_date" >= "start_date")
);
--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_campaigns_id_workspace_unique" ON "marketing_campaigns" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_workspace_status_start_index" ON "marketing_campaigns" ("workspace_id","status","start_date");--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_XwMdMChpC6FM_fkey" FOREIGN KEY ("audience_id") REFERENCES "marketing_brand_audiences"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_offer_id_marketing_brand_offers_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "marketing_brand_offers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_tenant_campaign_fkey" FOREIGN KEY ("campaign_id","workspace_id") REFERENCES "marketing_campaigns"("id","workspace_id") ON DELETE RESTRICT;