CREATE TABLE "marketing_brand_context_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"source_fingerprint" text NOT NULL,
	"prompt_version" text NOT NULL,
	"context_version" integer DEFAULT 1 NOT NULL,
	"compiled_text" text NOT NULL,
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"included_document_ids" jsonb DEFAULT '[]' NOT NULL,
	"omitted_document_count" integer DEFAULT 0 NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_brand_context_snapshots_counts_nonnegative" CHECK ("token_estimate" >= 0 and "omitted_document_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_context_snapshots_fingerprint_unique" ON "marketing_brand_context_snapshots" ("workspace_id","source_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_brand_context_snapshots_id_workspace_unique" ON "marketing_brand_context_snapshots" ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "marketing_brand_context_snapshots_recent_index" ON "marketing_brand_context_snapshots" ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "marketing_brand_context_snapshots" ADD CONSTRAINT "marketing_brand_context_snapshots_Tf3oGm3iOuFp_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;