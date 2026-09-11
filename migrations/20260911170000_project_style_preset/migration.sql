ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'style_preset_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'style_preset_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'style_preset_archived';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "style_preset_version_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_style_version_fkey" FOREIGN KEY ("style_preset_version_id","workspace_id") REFERENCES "public"."style_preset_versions"("id","workspace_id") ON DELETE no action ON UPDATE no action;
