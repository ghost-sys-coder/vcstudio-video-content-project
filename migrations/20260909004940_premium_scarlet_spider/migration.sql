ALTER TYPE "audit_action" ADD VALUE 'channel_profile_created' BEFORE 'role_changed';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'channel_profile_updated' BEFORE 'role_changed';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'channel_profile_archived' BEFORE 'role_changed';