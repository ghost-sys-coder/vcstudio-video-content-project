CREATE TABLE "marketing_campaign_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"platform" "content_platform" NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "brand_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD COLUMN "campaign_destination_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_campaign_destinations_campaign_connection_unique" ON "marketing_campaign_destinations" ("campaign_id","connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_campaign_destinations_id_workspace_unique" ON "marketing_campaign_destinations" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_campaign_destinations_selected_index" ON "marketing_campaign_destinations" ("workspace_id","campaign_id","is_selected");--> statement-breakpoint
ALTER TABLE "marketing_campaign_destinations" ADD CONSTRAINT "marketing_campaign_destinations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_campaign_destinations" ADD CONSTRAINT "marketing_campaign_destinations_tenant_campaign_fkey" FOREIGN KEY ("campaign_id","workspace_id") REFERENCES "marketing_campaigns"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_campaign_destinations" ADD CONSTRAINT "marketing_campaign_destinations_tenant_connection_fkey" FOREIGN KEY ("connection_id","workspace_id") REFERENCES "platform_connections"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_tenant_brand_profile_fkey" FOREIGN KEY ("brand_profile_id","workspace_id") REFERENCES "marketing_brand_profiles"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_content_items" ADD CONSTRAINT "marketing_content_items_tenant_destination_fkey" FOREIGN KEY ("campaign_destination_id","workspace_id") REFERENCES "marketing_campaign_destinations"("id","workspace_id") ON DELETE RESTRICT;