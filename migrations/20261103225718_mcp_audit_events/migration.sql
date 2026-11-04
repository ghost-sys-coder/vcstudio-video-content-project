ALTER TYPE "audit_action" ADD VALUE 'mcp_connection_changed' BEFORE 'workspace_created';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'mcp_action_completed' BEFORE 'workspace_created';--> statement-breakpoint
ALTER TYPE "audit_action" ADD VALUE 'mcp_action_failed' BEFORE 'workspace_created';