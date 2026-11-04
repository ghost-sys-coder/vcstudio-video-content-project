import type { McpScope } from "@studio/contracts";
export const MCP_SCOPE_TITLES: Record<McpScope, string> = {
  "vcstudio:read": "Read content",
  "vcstudio:edit": "Create and edit",
  "vcstudio:media": "Import and reuse media",
  "vcstudio:review": "Review content",
  "vcstudio:publish": "Publish and schedule",
};
export const MCP_SCOPE_LABELS: Record<McpScope, string> = {
  "vcstudio:read": "Read projects, scripts, scenes and Social content",
  "vcstudio:edit": "Create and edit project content and Social drafts",
  "vcstudio:media": "Import assets and assign scene images",
  "vcstudio:review": "Review and approve scripts, scenes and images",
  "vcstudio:publish": "Prepare publishing, schedules and cancellations",
};
