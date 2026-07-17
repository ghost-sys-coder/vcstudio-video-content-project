CREATE TYPE "scene_image_batch_status" AS ENUM('pending', 'processing', 'cancelled');--> statement-breakpoint
CREATE TABLE "scene_image_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "scene_image_batch_status" DEFAULT 'pending'::"scene_image_batch_status" NOT NULL,
	"request_nonce" uuid NOT NULL,
	"style_preset_version_id" uuid NOT NULL,
	"quality" "image_quality" NOT NULL,
	"size" text NOT NULL,
	"requested_scene_count" integer NOT NULL,
	"reserved_scene_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"dispatched_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_image_batches_scene_count_positive" CHECK ("requested_scene_count" > 0),
	CONSTRAINT "scene_image_batches_reserved_count_nonnegative" CHECK ("reserved_scene_count" >= 0),
	CONSTRAINT "scene_image_batches_estimated_cost_nonnegative" CHECK ("estimated_cost_cents" >= 0),
	CONSTRAINT "scene_image_batches_size_supported" CHECK ("size" in ('1536x1024', '1024x1536', '1024x1024'))
);
--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_batches_id_workspace_unique" ON "scene_image_batches" ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_image_batches_workspace_request_nonce_unique" ON "scene_image_batches" ("workspace_id","request_nonce");--> statement-breakpoint
CREATE INDEX "scene_image_batches_workspace_project_index" ON "scene_image_batches" ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "scene_image_generations_batch_index" ON "scene_image_generations" ("workspace_id","batch_id");--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD CONSTRAINT "scene_image_batches_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD CONSTRAINT "scene_image_batches_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD CONSTRAINT "scene_image_batches_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "projects"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scene_image_batches" ADD CONSTRAINT "scene_image_batches_tenant_style_fkey" FOREIGN KEY ("style_preset_version_id","workspace_id") REFERENCES "style_preset_versions"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_image_generations" ADD CONSTRAINT "scene_image_generations_tenant_batch_fkey" FOREIGN KEY ("batch_id","workspace_id") REFERENCES "scene_image_batches"("id","workspace_id") ON DELETE SET NULL;