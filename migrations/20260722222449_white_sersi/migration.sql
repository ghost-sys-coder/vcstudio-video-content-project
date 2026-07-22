CREATE TYPE "image_generation_purpose" AS ENUM('scene', 'variant_outpaint');--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "purpose" "image_generation_purpose" DEFAULT 'scene'::"image_generation_purpose" NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "output_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "source_image_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_output_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "project_output_variants"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_source_generation_fkey" FOREIGN KEY ("source_image_generation_id","project_id","workspace_id") REFERENCES "scene_image_generations"("id","project_id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_variant_outpaint_fields" CHECK (("purpose" = 'scene' and "output_variant_id" is null and "source_image_generation_id" is null) or ("purpose" = 'variant_outpaint' and "output_variant_id" is not null and "source_image_generation_id" is not null and "review_status" = 'pending'));
--> statement-breakpoint
INSERT INTO "prompt_template_versions" (
	"template_key", "version", "source_hash", "template_source"
) VALUES (
	'scene-outpaint',
	'scene-outpaint-v1',
	'edf57d722c63ce2f42ed6fa89787b8aef2694e8968ac0f96453d3b1f417b5f97',
	E'VCStudio scene outpaint prompt\nLayers: immutable approved source, target output dimensions, contextual canvas\nextension, identity continuity, style continuity, and negative constraints.'
) ON CONFLICT ("template_key", "version") DO NOTHING;
