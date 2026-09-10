CREATE TABLE "release_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"output_variant_id" uuid NOT NULL,
	"short_composition_id" uuid,
	"platform" "content_platform" NOT NULL,
	"channel_profile_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"title_suggestion_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"visibility" "publication_visibility" DEFAULT 'private'::"publication_visibility" NOT NULL,
	"thumbnail_generation_id" uuid,
	"caption" text,
	"share_to_feed" boolean,
	"planned_release_at" timestamp with time zone,
	"reviewed_render_id" uuid,
	"reviewed_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_packages_destination_unique" UNIQUE NULLS NOT DISTINCT("workspace_id","project_id","output_variant_id","short_composition_id","platform","channel_profile_id"),
	CONSTRAINT "release_packages_revision_positive" CHECK ("revision" >= 1),
	CONSTRAINT "release_packages_title_bounded" CHECK (length("title") <= 300),
	CONSTRAINT "release_packages_description_bounded" CHECK (length("description") <= 10000)
);--> statement-breakpoint
CREATE TABLE "release_package_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"release_package_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"render_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"visibility" "publication_visibility" NOT NULL,
	"thumbnail_generation_id" uuid,
	"caption" text,
	"share_to_feed" boolean,
	"planned_release_at" timestamp with time zone,
	"frozen_by_user_id" uuid NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_package_revisions_number_positive" CHECK ("revision_number" >= 1),
	CONSTRAINT "release_package_revisions_title_present" CHECK (length("title") > 0)
);--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "release_package_revision_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "release_package_revisions_id_workspace_unique" ON "release_package_revisions" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_package_revisions_number_unique" ON "release_package_revisions" ("release_package_id","revision_number");--> statement-breakpoint
CREATE INDEX "release_package_revisions_package_index" ON "release_package_revisions" ("release_package_id","frozen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "release_packages_id_workspace_unique" ON "release_packages" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "release_packages_workspace_project_index" ON "release_packages" ("workspace_id","project_id","updated_at");--> statement-breakpoint
ALTER TABLE "release_package_revisions" ADD CONSTRAINT "release_package_revisions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_package_revisions" ADD CONSTRAINT "release_package_revisions_frozen_by_user_id_users_id_fkey" FOREIGN KEY ("frozen_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "release_package_revisions" ADD CONSTRAINT "release_package_revisions_tenant_package_fkey" FOREIGN KEY ("release_package_id","workspace_id") REFERENCES "release_packages"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_channel_profile_id_channel_profiles_id_fkey" FOREIGN KEY ("channel_profile_id") REFERENCES "channel_profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_ZIYT8H2gbi2O_fkey" FOREIGN KEY ("title_suggestion_id") REFERENCES "project_title_suggestions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_qkDMEnTisyza_fkey" FOREIGN KEY ("thumbnail_generation_id") REFERENCES "thumbnail_generations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_tenant_output_variant_fkey" FOREIGN KEY ("output_variant_id","workspace_id") REFERENCES "project_output_variants"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release_packages" ADD CONSTRAINT "release_packages_tenant_short_fkey" FOREIGN KEY ("short_composition_id","workspace_id") REFERENCES "short_compositions"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_publications" ADD CONSTRAINT "video_publications_vsyw5Bj3mPhU_fkey" FOREIGN KEY ("release_package_revision_id") REFERENCES "release_package_revisions"("id") ON DELETE SET NULL;
