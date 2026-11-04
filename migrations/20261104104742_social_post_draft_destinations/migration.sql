CREATE TABLE "social_post_draft_destinations" (
	"workspace_id" uuid NOT NULL,
	"post_id" uuid,
	"connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_post_draft_destinations_pkey" PRIMARY KEY("post_id","connection_id")
);
--> statement-breakpoint
CREATE INDEX "social_post_draft_destinations_workspace_connection_index" ON "social_post_draft_destinations" ("workspace_id","connection_id");--> statement-breakpoint
ALTER TABLE "social_post_draft_destinations" ADD CONSTRAINT "social_post_draft_destinations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_draft_destinations" ADD CONSTRAINT "social_post_draft_destinations_tenant_post_fkey" FOREIGN KEY ("post_id","workspace_id") REFERENCES "social_posts"("id","workspace_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "social_post_draft_destinations" ADD CONSTRAINT "social_post_draft_destinations_tenant_connection_fkey" FOREIGN KEY ("connection_id","workspace_id") REFERENCES "platform_connections"("id","workspace_id") ON DELETE CASCADE;
--> statement-breakpoint
-- Preserve the selected accounts of existing scheduled/published posts without
-- changing any publication targets or starting work.
INSERT INTO "social_post_draft_destinations" ("workspace_id", "post_id", "connection_id")
SELECT target.workspace_id, target.post_id, target.connection_id
FROM social_post_targets target
JOIN social_posts post ON post.id = target.post_id AND post.workspace_id = target.workspace_id
JOIN platform_connections connection ON connection.id = target.connection_id AND connection.workspace_id = target.workspace_id
ON CONFLICT DO NOTHING;
