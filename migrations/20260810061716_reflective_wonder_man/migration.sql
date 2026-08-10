CREATE TABLE "marketing_knowledge_document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"checksum" text NOT NULL,
	"token_estimate" integer NOT NULL,
	"source_location" jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"key_facts" jsonb DEFAULT '[]' NOT NULL,
	"summary_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_knowledge_document_chunks_values_nonnegative" CHECK ("chunk_index" >= 0 and "token_estimate" >= 0)
);
--> statement-breakpoint
ALTER TABLE "marketing_brand_context_snapshots" ADD COLUMN "included_document_claims" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "extraction_version" text DEFAULT 'knowledge-extraction-v2' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "summary_version" text;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketing_knowledge_documents" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_knowledge_document_chunks_position_unique" ON "marketing_knowledge_document_chunks" ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "marketing_knowledge_document_chunks_workspace_index" ON "marketing_knowledge_document_chunks" ("workspace_id","document_id");--> statement-breakpoint
CREATE INDEX "marketing_knowledge_document_chunks_fts_index" ON "marketing_knowledge_document_chunks" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_knowledge_documents_id_workspace_unique" ON "marketing_knowledge_documents" ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "marketing_knowledge_document_chunks" ADD CONSTRAINT "marketing_knowledge_document_chunks_tenant_document_fkey" FOREIGN KEY ("document_id","workspace_id") REFERENCES "marketing_knowledge_documents"("id","workspace_id") ON DELETE CASCADE;