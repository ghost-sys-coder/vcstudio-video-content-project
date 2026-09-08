CREATE TABLE "scene_revision_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"image_generation_id" uuid,
	"audio_generation_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_revision_media_slot_valid" CHECK (("slot" = 'audio' and "audio_generation_id" is not null and "image_generation_id" is null) or ("slot" in ('1024x1024', '1536x1024', '1024x1536') and "image_generation_id" is not null and "audio_generation_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scene_revision_media_version_slot_unique" ON "scene_revision_media" ("scene_version_id","slot");--> statement-breakpoint
CREATE INDEX "scene_revision_media_scope_index" ON "scene_revision_media" ("workspace_id","project_id","scene_version_id");--> statement-breakpoint
ALTER TABLE "scene_revision_media" ADD CONSTRAINT "scene_revision_media_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_revision_media" ADD CONSTRAINT "scene_revision_media_version_fk" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_revision_media" ADD CONSTRAINT "scene_revision_media_image_fk" FOREIGN KEY ("image_generation_id","project_id","workspace_id") REFERENCES "scene_image_generations"("id","project_id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_revision_media" ADD CONSTRAINT "scene_revision_media_audio_fk" FOREIGN KEY ("audio_generation_id","project_id","workspace_id") REFERENCES "scene_audio_generations"("id","project_id","workspace_id") ON DELETE RESTRICT;