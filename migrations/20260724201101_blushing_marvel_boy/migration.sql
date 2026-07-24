CREATE TYPE "workspace_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'member_invited';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'invitation_revoked';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'member_joined';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'member_removed';--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"status" "workspace_invitation_status" DEFAULT 'pending'::"workspace_invitation_status" NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"clerk_invitation_id" text,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_status_index" ON "workspace_invitations" ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_workspace_email_pending_unique" ON "workspace_invitations" ("workspace_id","email") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_user_id_users_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_user_id_users_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;