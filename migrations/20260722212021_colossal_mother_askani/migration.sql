CREATE TYPE "output_variant_status" AS ENUM('draft', 'ready', 'archived');--> statement-breakpoint
CREATE TYPE "scene_framing_mode" AS ENUM('cover', 'contain', 'outpaint');--> statement-breakpoint
CREATE TABLE "project_output_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aspect_ratio" "project_aspect_ratio" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"status" "output_variant_status" DEFAULT 'draft'::"output_variant_status" NOT NULL,
	"caption_style" jsonb,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_output_variants_width_positive" CHECK ("width" > 0),
	CONSTRAINT "project_output_variants_height_positive" CHECK ("height" > 0),
	CONSTRAINT "project_output_variants_dimensions_match_aspect" CHECK (("aspect_ratio" = '16:9' and "width" = 1920 and "height" = 1080)
        or ("aspect_ratio" = '9:16' and "width" = 1080 and "height" = 1920)
        or ("aspect_ratio" = '1:1' and "width" = 1080 and "height" = 1080))
);
--> statement-breakpoint
CREATE TABLE "scene_variant_framings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"output_variant_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"source_image_generation_id" uuid NOT NULL,
	"mode" "scene_framing_mode" DEFAULT 'cover'::"scene_framing_mode" NOT NULL,
	"focal_point_x_bps" integer DEFAULT 5000 NOT NULL,
	"focal_point_y_bps" integer DEFAULT 5000 NOT NULL,
	"scale_bps" integer DEFAULT 10000 NOT NULL,
	"background_color" text DEFAULT '#000000' NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_variant_framings_focal_x_range" CHECK ("focal_point_x_bps" between 0 and 10000),
	CONSTRAINT "scene_variant_framings_focal_y_range" CHECK ("focal_point_y_bps" between 0 and 10000),
	CONSTRAINT "scene_variant_framings_scale_range" CHECK ("scale_bps" between 10000 and 30000),
	CONSTRAINT "scene_variant_framings_background_color_hex" CHECK ("background_color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_output_variants_id_workspace_unique" ON "project_output_variants" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_output_variants_project_aspect_unique" ON "project_output_variants" ("project_id","aspect_ratio");--> statement-breakpoint
CREATE INDEX "project_output_variants_workspace_project_index" ON "project_output_variants" ("workspace_id","project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_variant_framings_variant_scene_version_unique" ON "scene_variant_framings" ("output_variant_id","scene_version_id");--> statement-breakpoint
CREATE INDEX "scene_variant_framings_workspace_project_variant_index" ON "scene_variant_framings" ("workspace_id","project_id","output_variant_id");--> statement-breakpoint
ALTER TABLE "project_output_variants" ADD CONSTRAINT "project_output_variants_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_output_variants" ADD CONSTRAINT "project_output_variants_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_output_variants" ADD CONSTRAINT "project_output_variants_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "project_output_variants" (
	"workspace_id",
	"project_id",
	"name",
	"aspect_ratio",
	"width",
	"height",
	"status",
	"created_by_user_id"
)
SELECT
	project."workspace_id",
	project."id",
	variant."name",
	variant."aspect_ratio"::"project_aspect_ratio",
	variant."width",
	variant."height",
	CASE
		WHEN project."aspect_ratio"::text = variant."aspect_ratio"
			THEN 'ready'::"output_variant_status"
		ELSE 'draft'::"output_variant_status"
	END,
	project."created_by_user_id"
FROM "projects" project
CROSS JOIN (
	VALUES
		('Landscape', '16:9', 1920, 1080),
		('Vertical', '9:16', 1080, 1920),
		('Square', '1:1', 1080, 1080)
) AS variant("name", "aspect_ratio", "width", "height");--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_tenant_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "project_output_variants"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_tenant_scene_fkey" FOREIGN KEY ("scene_id","project_id","workspace_id") REFERENCES "scenes"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_tenant_scene_version_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_variant_framings" ADD CONSTRAINT "scene_variant_framings_tenant_source_image_fkey" FOREIGN KEY ("source_image_generation_id","project_id","workspace_id") REFERENCES "scene_image_generations"("id","project_id","workspace_id") ON DELETE RESTRICT;
