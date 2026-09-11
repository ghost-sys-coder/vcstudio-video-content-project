CREATE TYPE "public"."editorial_source_kind" AS ENUM('link', 'note');--> statement-breakpoint
CREATE TYPE "public"."claim_review_state" AS ENUM('unchecked', 'supported', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."claim_source_stance" AS ENUM('supports', 'disputes');--> statement-breakpoint
CREATE TABLE "project_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "editorial_source_kind" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"host" text,
	"notes" text DEFAULT '' NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sources_title_present" CHECK (length(btrim("project_sources"."title")) > 0),
	CONSTRAINT "project_sources_link_fields" CHECK (("project_sources"."kind" = 'link' and "project_sources"."url" is not null and "project_sources"."host" is not null)
        or ("project_sources"."kind" <> 'link' and "project_sources"."url" is null and "project_sources"."host" is null))
);
--> statement-breakpoint
CREATE TABLE "script_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"quoted_text" text NOT NULL,
	"review_state" "claim_review_state" DEFAULT 'unchecked'::"claim_review_state" NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_claims_quote_present" CHECK (length(btrim("script_claims"."quoted_text")) > 0),
	CONSTRAINT "script_claims_review_attribution" CHECK ("script_claims"."review_state" = 'unchecked'
        or ("script_claims"."reviewed_by_user_id" is not null and "script_claims"."reviewed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "script_claim_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"stance" "claim_source_stance" NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_editorial_signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"script_fingerprint" text NOT NULL,
	"covered_claims" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"signed_by_user_id" uuid NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_version_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"script_version_id" uuid NOT NULL,
	"evidence" jsonb NOT NULL,
	"claim_count" integer NOT NULL,
	"supported_count" integer NOT NULL,
	"disputed_count" integer NOT NULL,
	"unchecked_count" integer NOT NULL,
	"signed_off_by_user_id" uuid,
	"signed_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_version_evidence_counts_nonnegative" CHECK ("script_version_evidence"."claim_count" >= 0 and "script_version_evidence"."supported_count" >= 0
        and "script_version_evidence"."disputed_count" >= 0 and "script_version_evidence"."unchecked_count" >= 0),
	CONSTRAINT "script_version_evidence_counts_total" CHECK ("script_version_evidence"."claim_count" = "script_version_evidence"."supported_count" + "script_version_evidence"."disputed_count" + "script_version_evidence"."unchecked_count")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_script_versions_tenant_unique" ON "project_script_versions" USING btree ("id","project_id","workspace_id");--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claims" ADD CONSTRAINT "script_claims_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claims" ADD CONSTRAINT "script_claims_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claims" ADD CONSTRAINT "script_claims_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claims" ADD CONSTRAINT "script_claims_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_sources_id_workspace_unique" ON "project_sources" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "project_sources_workspace_project_index" ON "project_sources" USING btree ("workspace_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "script_claims_id_workspace_unique" ON "script_claims" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "script_claims_workspace_project_index" ON "script_claims" USING btree ("workspace_id","project_id","created_at");--> statement-breakpoint
ALTER TABLE "script_claim_sources" ADD CONSTRAINT "script_claim_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claim_sources" ADD CONSTRAINT "script_claim_sources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claim_sources" ADD CONSTRAINT "script_claim_sources_tenant_claim_fkey" FOREIGN KEY ("claim_id","workspace_id") REFERENCES "public"."script_claims"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_claim_sources" ADD CONSTRAINT "script_claim_sources_tenant_source_fkey" FOREIGN KEY ("source_id","workspace_id") REFERENCES "public"."project_sources"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "script_claim_sources_unique" ON "script_claim_sources" USING btree ("claim_id","source_id");--> statement-breakpoint
CREATE INDEX "script_claim_sources_workspace_index" ON "script_claim_sources" USING btree ("workspace_id","claim_id");--> statement-breakpoint
ALTER TABLE "script_editorial_signoffs" ADD CONSTRAINT "script_editorial_signoffs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_editorial_signoffs" ADD CONSTRAINT "script_editorial_signoffs_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_editorial_signoffs" ADD CONSTRAINT "script_editorial_signoffs_tenant_project_fkey" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "script_editorial_signoffs_project_unique" ON "script_editorial_signoffs" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "script_version_evidence" ADD CONSTRAINT "script_version_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_version_evidence" ADD CONSTRAINT "script_version_evidence_signed_off_by_user_id_users_id_fk" FOREIGN KEY ("signed_off_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_version_evidence" ADD CONSTRAINT "script_version_evidence_tenant_version_fkey" FOREIGN KEY ("script_version_id","project_id","workspace_id") REFERENCES "public"."project_script_versions"("id","project_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "script_version_evidence_version_unique" ON "script_version_evidence" USING btree ("script_version_id");--> statement-breakpoint
CREATE INDEX "script_version_evidence_workspace_project_index" ON "script_version_evidence" USING btree ("workspace_id","project_id");
