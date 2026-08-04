CREATE TYPE "marketing_brand_asset_role" AS ENUM('logo_primary', 'logo_alt', 'logo_mark', 'wordmark', 'product_shot', 'team_photo', 'brand_pattern', 'font_specimen', 'screenshot', 'other');--> statement-breakpoint
CREATE TYPE "marketing_document_source" AS ENUM('upload', 'pasted', 'url_capture');--> statement-breakpoint
CREATE TYPE "marketing_document_status" AS ENUM('pending', 'extracting', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "marketing_brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"role" "marketing_brand_asset_role" NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_kind" "marketing_document_source" DEFAULT 'upload'::"marketing_document_source" NOT NULL,
	"source_url" text,
	"object_key" text,
	"content_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"original_file_name" text DEFAULT '' NOT NULL,
	"status" "marketing_document_status" DEFAULT 'pending'::"marketing_document_status" NOT NULL,
	"extracted_text" text DEFAULT '' NOT NULL,
	"extracted_character_count" integer DEFAULT 0 NOT NULL,
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"key_facts" jsonb DEFAULT '[]' NOT NULL,
	"checksum" text DEFAULT '' NOT NULL,
	"include_in_context" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"error_category" text,
	"safe_error_message" text,
	"created_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_knowledge_documents_size_nonnegative" CHECK ("size_bytes" >= 0),
	CONSTRAINT "marketing_knowledge_documents_source_object" CHECK (("source_kind" = 'pasted') = ("object_key" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_assets_workspace_asset_unique" ON "marketing_brand_assets" ("workspace_id","media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_assets_primary_logo_unique" ON "marketing_brand_assets" ("workspace_id") WHERE "role" = 'logo_primary';--> statement-breakpoint
CREATE INDEX "marketing_brand_assets_role_index" ON "marketing_brand_assets" ("workspace_id","role","position");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_knowledge_documents_object_key_unique" ON "marketing_knowledge_documents" ("object_key") WHERE "object_key" is not null;--> statement-breakpoint
CREATE INDEX "marketing_knowledge_documents_status_index" ON "marketing_knowledge_documents" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "marketing_knowledge_documents_context_index" ON "marketing_knowledge_documents" ("workspace_id","include_in_context","priority","created_at");--> statement-breakpoint
ALTER TABLE "marketing_brand_assets" ADD CONSTRAINT "marketing_brand_assets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_brand_assets" ADD CONSTRAINT "marketing_brand_assets_tenant_media_fkey" FOREIGN KEY ("media_asset_id","workspace_id") REFERENCES "media_assets"("id","workspace_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD CONSTRAINT "marketing_knowledge_documents_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD CONSTRAINT "marketing_knowledge_documents_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;