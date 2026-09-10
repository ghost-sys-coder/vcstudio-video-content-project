CREATE TYPE "public"."publication_finishing_step" AS ENUM('thumbnail', 'captions', 'playlist');--> statement-breakpoint
CREATE TYPE "public"."publication_finishing_state" AS ENUM('pending', 'succeeded', 'failed', 'unsupported', 'skipped');--> statement-breakpoint
ALTER TABLE "release_packages" ADD COLUMN "made_for_kids" boolean;--> statement-breakpoint
ALTER TABLE "release_packages" ADD COLUMN "contains_synthetic_media" boolean;--> statement-breakpoint
ALTER TABLE "release_packages" ADD COLUMN "youtube_playlist_id" text;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "made_for_kids" boolean;--> statement-breakpoint
ALTER TABLE "video_publications" ADD COLUMN "contains_synthetic_media" boolean;--> statement-breakpoint
CREATE TABLE "publication_finishing_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"step" "publication_finishing_step" NOT NULL,
	"state" "publication_finishing_state" DEFAULT 'pending'::"publication_finishing_state" NOT NULL,
	"detail" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_finishing_steps_attempts_nonnegative" CHECK ("publication_finishing_steps"."attempt_count" >= 0),
	CONSTRAINT "publication_finishing_steps_settled_fields" CHECK ("publication_finishing_steps"."state" in ('pending') or "publication_finishing_steps"."completed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "publication_finishing_steps" ADD CONSTRAINT "publication_finishing_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_finishing_steps" ADD CONSTRAINT "publication_finishing_steps_tenant_publication_fkey" FOREIGN KEY ("publication_id","workspace_id") REFERENCES "public"."video_publications"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_finishing_steps_unique" ON "publication_finishing_steps" USING btree ("publication_id","step");--> statement-breakpoint
CREATE INDEX "publication_finishing_steps_workspace_index" ON "publication_finishing_steps" USING btree ("workspace_id","publication_id");
