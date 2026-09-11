ALTER TYPE "public"."media_asset_kind" ADD VALUE IF NOT EXISTS 'audio';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_render_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"background_media_asset_id" uuid,
	"background_volume_percent" integer DEFAULT 12 NOT NULL,
	"background_loop" boolean DEFAULT true NOT NULL,
	"level_meter_enabled" boolean DEFAULT false NOT NULL,
	"level_meter_position" text DEFAULT 'bottomRight' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_render_effects_volume_range" CHECK ("project_render_effects"."background_volume_percent" between 0 and 100),
	CONSTRAINT "project_render_effects_revision_positive" CHECK ("project_render_effects"."revision" > 0),
	CONSTRAINT "project_render_effects_meter_position" CHECK ("project_render_effects"."level_meter_position" in ('bottomLeft', 'bottomCenter', 'bottomRight', 'topLeft', 'topCenter', 'topRight'))
);
--> statement-breakpoint
ALTER TABLE "project_render_effects" ADD CONSTRAINT "project_render_effects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_render_effects" ADD CONSTRAINT "project_render_effects_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_render_effects" ADD CONSTRAINT "project_render_effects_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_render_effects" ADD CONSTRAINT "project_render_effects_tenant_media_fkey" FOREIGN KEY ("background_media_asset_id","workspace_id") REFERENCES "public"."media_assets"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_render_effects_project_unique" ON "project_render_effects" USING btree ("project_id");
