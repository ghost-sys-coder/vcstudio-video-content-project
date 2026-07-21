import type { AuditAction } from "@/db/schema";

export type { AuditAction };

export type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue>;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  workspace_created: "Workspace created",
  role_changed: "Member role changed",
  project_archived: "Project archived",
  project_restored: "Project restored",
  script_restored: "Script version restored",
  scene_approved: "Scene approved",
  asset_approved: "Asset approved",
  generation_started: "Generation started",
  generation_cancelled: "Generation cancelled",
  render_started: "Render started",
  export_deleted: "Export deleted",
  budget_changed: "Budget changed",
  limits_changed: "Operational limits changed",
  platform_connected: "Platform account connected",
  platform_disconnected: "Platform account disconnected",
  video_published: "Video published to platform",
};

// Keys whose values are genuinely sensitive and must never be persisted to the
// audit log, regardless of the value shape.
const FORBIDDEN_KEY_PATTERN =
  /(secret|token|password|signature|authorization|bearer|credential|apikey|api_key)/i;

/**
 * Produces a metadata object safe to persist in the append-only audit log.
 * Drops sensitive keys, URL-looking string values (covers signed R2 URLs), and
 * any non-primitive value. Long strings are truncated. This is the single choke
 * point that keeps secrets and signed URLs out of the audit trail.
 */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): AuditMetadata {
  const safe: AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
    if (value === null) {
      safe[key] = null;
    } else if (typeof value === "string") {
      if (/^https?:\/\//i.test(value.trim())) continue;
      safe[key] = value.length > 500 ? value.slice(0, 500) : value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
    } else if (typeof value === "boolean") {
      safe[key] = value;
    }
    // Objects, arrays, undefined, NaN, and infinities are intentionally dropped.
  }
  return safe;
}
