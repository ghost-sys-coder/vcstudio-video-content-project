ALTER TABLE "generation_reference_assets" DROP CONSTRAINT "generation_reference_assets_2TggRZ3uOpJQ_fkey";--> statement-breakpoint
ALTER TABLE "generation_reference_assets" DROP CONSTRAINT "generation_reference_assets_character_id_characters_id_fkey";--> statement-breakpoint
ALTER TABLE "provider_requests" DROP CONSTRAINT "provider_requests_generation_id_scene_image_generations_id_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations" DROP CONSTRAINT "scene_image_generations_project_id_projects_id_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations" DROP CONSTRAINT "scene_image_generations_scene_id_scenes_id_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations" DROP CONSTRAINT "scene_image_generations_scene_version_id_scene_versions_id_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations" DROP CONSTRAINT "scene_image_generations_2jglSAH7gK6N_fkey";--> statement-breakpoint
ALTER TABLE "style_preset_versions" DROP CONSTRAINT "style_preset_versions_style_preset_id_style_presets_id_fkey";--> statement-breakpoint
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_reservation_id_usage_reservations_id_fkey";--> statement-breakpoint
ALTER TABLE "usage_reservations" DROP CONSTRAINT "usage_reservations_UfvakekGxwl3_fkey";--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "background" text DEFAULT 'opaque' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "character_reference_assets_id_character_workspace_unique" ON "character_reference_assets" ("id","character_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_id_workspace_unique" ON "characters" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "generation_reference_assets_reference_index" ON "generation_reference_assets" ("reference_asset_id");--> statement-breakpoint
CREATE INDEX "generation_reference_assets_character_index" ON "generation_reference_assets" ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_id_workspace_unique" ON "projects" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_id_workspace_unique" ON "scene_image_generations" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_generations_id_project_workspace_unique" ON "scene_image_generations" ("id","project_id","workspace_id");--> statement-breakpoint
CREATE INDEX "scene_image_generations_style_preset_version_index" ON "scene_image_generations" ("style_preset_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_versions_id_scene_project_workspace_unique" ON "scene_versions" ("id","scene_id","project_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenes_id_project_workspace_unique" ON "scenes" ("id","project_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "style_preset_versions_id_workspace_unique" ON "style_preset_versions" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "style_presets_id_workspace_unique" ON "style_presets" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_id_operation_project_workspace_unique" ON "usage_reservations" ("id","operation_type","project_id","workspace_id");--> statement-breakpoint
CREATE INDEX "usage_reservations_status_expires_index" ON "usage_reservations" ("status","expires_at");--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_tenant_generation_fkey" FOREIGN KEY ("generation_id","workspace_id") REFERENCES "scene_image_generations"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_tenant_character_fkey" FOREIGN KEY ("character_id","workspace_id") REFERENCES "characters"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_tenant_generation_fkey" FOREIGN KEY ("generation_id","project_id","workspace_id") REFERENCES "scene_image_generations"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_scene_fkey" FOREIGN KEY ("scene_id","project_id","workspace_id") REFERENCES "scenes"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_version_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_style_fkey" FOREIGN KEY ("style_preset_version_id","workspace_id") REFERENCES "style_preset_versions"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "style_preset_versions" ADD CONSTRAINT "style_preset_versions_tenant_preset_fkey" FOREIGN KEY ("style_preset_id","workspace_id") REFERENCES "style_presets"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_reservation_fkey" FOREIGN KEY ("reservation_id","operation_type","project_id","workspace_id") REFERENCES "usage_reservations"("id","operation_type","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_reservations" ADD CONSTRAINT "usage_reservations_tenant_generation_fkey" FOREIGN KEY ("image_generation_id","project_id","workspace_id") REFERENCES "scene_image_generations"("id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generation_reference_assets" ADD CONSTRAINT "generation_reference_assets_live_snapshot_match" CHECK ("reference_asset_id" is null or "reference_asset_id" = "reference_asset_id_snapshot");--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0 and ("actual_cost_cents" is null or "actual_cost_cents" >= 0));--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_background_supported" CHECK ("background" in ('opaque', 'auto'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_generation_reference_asset_tenant"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF NEW."reference_asset_id" IS NULL THEN
		RETURN NEW;
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM "public"."character_reference_assets" AS "reference_asset"
		WHERE "reference_asset"."id" = NEW."reference_asset_id"
			AND "reference_asset"."character_id" = NEW."character_id"
			AND "reference_asset"."workspace_id" = NEW."workspace_id"
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23503',
			MESSAGE = 'Generation reference assets must match the selected character and workspace.';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "generation_reference_assets_tenant_reference_guard"
BEFORE INSERT OR UPDATE OF "workspace_id", "character_id", "reference_asset_id"
ON "generation_reference_assets"
FOR EACH ROW
EXECUTE FUNCTION "enforce_generation_reference_asset_tenant"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_usage_event_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE'
		AND pg_trigger_depth() > 1
		AND (
			NOT EXISTS (
				SELECT 1
				FROM "public"."usage_reservations"
				WHERE "id" = OLD."reservation_id"
			)
			OR NOT EXISTS (
				SELECT 1
				FROM "public"."projects"
				WHERE "id" = OLD."project_id"
			)
			OR NOT EXISTS (
				SELECT 1
				FROM "public"."workspaces"
				WHERE "id" = OLD."workspace_id"
			)
		) THEN
		RETURN OLD;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Usage events are append-only and cannot be directly updated or deleted.';
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "usage_events_append_only"
BEFORE UPDATE OR DELETE ON "usage_events"
FOR EACH ROW
EXECUTE FUNCTION "protect_usage_event_append_only"();
