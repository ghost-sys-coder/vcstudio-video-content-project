import type { McpOperationStatus } from "@studio/contracts";

const clientNames = new Map([
  ["chatgpt.com", "ChatGPT"],
  ["chat.openai.com", "ChatGPT"],
  ["claude.ai", "Claude"],
  ["claude.com", "Claude"],
]);
/** Display only: the full OAuth client identifier remains visible on its card. */
export function getMcpClientName(clientId: string): string {
  try {
    const url = new URL(clientId);
    if (url.protocol !== "https:") return "AI application";
    return clientNames.get(url.hostname) ?? url.hostname;
  } catch {
    return "AI application";
  }
}
export function formatMcpActivityKind(kind: string): string {
  const label = kind.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
const activityDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
export function formatMcpActivityDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : `${activityDate.format(date)} UTC`;
}
const ready =
  "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground";
const waiting =
  "border-notice-warning-edge bg-notice-warning text-notice-warning-foreground";
const neutral = "bg-muted text-muted-foreground";
export const MCP_ACTIVITY_STATUSES: Record<
  McpOperationStatus,
  { label: string; className: string }
> = {
  awaiting_upload: { label: "Awaiting upload", className: waiting },
  requires_approval: { label: "Awaiting approval", className: waiting },
  prepared: { label: "Prepared for agent execution", className: neutral },
  queued: { label: "Queued", className: neutral },
  running: {
    label: "In progress",
    className:
      "border-notice-info-edge bg-notice-info text-notice-info-foreground",
  },
  approved: { label: "Approved", className: ready },
  succeeded: { label: "Completed", className: ready },
  failed: {
    label: "Failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  cancelled: { label: "Cancelled", className: neutral },
  expired: { label: "Expired", className: neutral },
};
