CREATE TABLE "scene_caption_cues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"scene_version_id" uuid NOT NULL,
	"audio_generation_id" uuid NOT NULL,
	"cues" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_caption_cues_not_empty" CHECK (jsonb_typeof("scene_caption_cues"."cues") = 'array' and jsonb_array_length("scene_caption_cues"."cues") > 0),
	CONSTRAINT "scene_caption_cues_revision_positive" CHECK ("scene_caption_cues"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "scene_caption_cues" ADD CONSTRAINT "scene_caption_cues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_caption_cues" ADD CONSTRAINT "scene_caption_cues_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_caption_cues" ADD CONSTRAINT "scene_caption_cues_tenant_version_fkey" FOREIGN KEY ("scene_version_id","scene_id","project_id","workspace_id") REFERENCES "public"."scene_versions"("id","scene_id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_caption_cues" ADD CONSTRAINT "scene_caption_cues_tenant_audio_fkey" FOREIGN KEY ("audio_generation_id","workspace_id") REFERENCES "public"."scene_audio_generations"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_caption_cues_version_audio_unique" ON "scene_caption_cues" USING btree ("scene_version_id","audio_generation_id");--> statement-breakpoint
CREATE INDEX "scene_caption_cues_workspace_project_index" ON "scene_caption_cues" USING btree ("workspace_id","project_id");
