import "server-only";

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { unstable_cache } from "next/cache";
import { loadReadinessDatabaseSnapshot } from "@/db/repositories/readiness.repository";
import { getR2Client } from "@/lib/storage/r2-client";

export type ReadinessStatus =
  "ready" | "degraded" | "blocked" | "disabled" | "unknown";
export type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  action: string | null;
};
export type ReadinessView = {
  checkedAt: Date;
  deployment: ReadinessItem[];
  workspace: ReadinessItem[];
};

function configured(...keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

async function probeR2(): Promise<ReadinessItem> {
  if (
    !configured(
      "R2_BUCKET_NAME",
      "R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    )
  )
    return {
      id: "r2",
      label: "Private object storage",
      status: "blocked",
      detail: "R2 is not fully configured.",
      action:
        "Configure the four R2 server variables for the web and worker runtimes.",
    };
  try {
    await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: 1,
      }),
    );
    return {
      id: "r2",
      label: "Private object storage",
      status: "ready",
      detail: "A metadata-only bucket probe succeeded.",
      action: null,
    };
  } catch {
    return {
      id: "r2",
      label: "Private object storage",
      status: "blocked",
      detail: "The configured bucket could not be queried.",
      action:
        "Verify the R2 endpoint, bucket, credentials, and bucket permissions.",
    };
  }
}

export async function loadOperationalReadiness(
  workspaceId: string,
): Promise<ReadinessView> {
  const now = new Date();
  const environment = process.env.READINESS_ENVIRONMENT ?? "development";
  const snapshot = await loadReadinessDatabaseSnapshot({
    workspaceId,
    environment,
    staleBefore: new Date(now.getTime() - 30 * 60_000),
  });
  const heartbeatAge = snapshot.heartbeat?.lastCompletedAt
    ? now.getTime() - snapshot.heartbeat.lastCompletedAt.getTime()
    : null;
  const workerStatus: ReadinessStatus =
    heartbeatAge === null
      ? "unknown"
      : heartbeatAge > 15 * 60_000
        ? "blocked"
        : "ready";
  const publishingEnabled = process.env.ENABLE_VIDEO_PUBLISHING !== "false";
  const configuredPlatforms = [
    configured("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET")
      ? "YouTube"
      : null,
    configured("FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET") ? "Facebook" : null,
    configured("INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET") ? "Instagram" : null,
    configured("TIKTOK_API_CLIENT_KEY", "TIKTOK_API_CLIENT_SECRET")
      ? "TikTok"
      : null,
    configured("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET")
      ? "LinkedIn"
      : null,
    configured("TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET") ? "X" : null,
  ].filter(Boolean);
  const activeConnections = snapshot.connections.filter(
    (connection) =>
      connection.status === "active" &&
      (!connection.expiresAt || connection.expiresAt > now),
  );
  const expiredConnections =
    snapshot.connections.length - activeConnections.length;
  const google = snapshot.googleBusiness;
  return {
    checkedAt: now,
    deployment: [
      {
        id: "schema",
        label: "Database schema",
        status: snapshot.schemaCompatible ? "ready" : "blocked",
        detail: snapshot.schemaCompatible
          ? "Required readiness and reconciliation tables are present."
          : "Required migrations are missing.",
        action: snapshot.schemaCompatible
          ? null
          : "Run npm run db:migrate against this environment.",
      },
      await probeR2(),
      {
        id: "worker",
        label: "Trigger.dev worker",
        status: workerStatus,
        detail:
          heartbeatAge === null
            ? "No heartbeat has been recorded for this environment."
            : `Last completed ${Math.max(0, Math.round(heartbeatAge / 60_000))} minutes ago.`,
        action:
          workerStatus === "ready"
            ? null
            : "Deploy Trigger.dev and verify the operational-readiness-heartbeat schedule.",
      },
      {
        id: "publishing",
        label: "Publishing mode",
        status: publishingEnabled ? "ready" : "disabled",
        detail:
          process.env.ENABLE_PUBLISH_SIMULATION === "true"
            ? "Video publishing is in simulation mode."
            : "Video publishing is in live-provider mode.",
        action: publishingEnabled
          ? null
          : "Enable video publishing only after provider configuration is complete.",
      },
      {
        id: "providers",
        label: "OAuth provider configuration",
        status: configuredPlatforms.length ? "ready" : "blocked",
        detail: `${configuredPlatforms.length} provider configurations detected. Credential values are never exposed.`,
        action: configuredPlatforms.length
          ? null
          : "Configure at least one publishing provider in both required runtimes.",
      },
    ],
    workspace: [
      {
        id: "stuck",
        label: "Stuck operations",
        status: snapshot.stuckCount > 0 ? "degraded" : "ready",
        detail: `${snapshot.stuckCount} active operation${snapshot.stuckCount === 1 ? "" : "s"} have not progressed for 30 minutes.`,
        action: snapshot.stuckCount
          ? "Review failed work and confirm the reconciliation schedules are running."
          : null,
      },
      {
        id: "connections",
        label: "Publishing authorizations",
        status: activeConnections.length
          ? expiredConnections
            ? "degraded"
            : "ready"
          : "blocked",
        detail: `${activeConnections.length} active; ${expiredConnections} expired, revoked, or unhealthy.`,
        action: activeConnections.length
          ? expiredConnections
            ? "Reconnect unhealthy destinations in workspace settings."
            : null
          : "Connect at least one publishing destination.",
      },
      {
        id: "google-business",
        label: "Google Business Profile",
        status: !google
          ? "disabled"
          : google.status !== "active"
            ? "blocked"
            : google.syncStatus === "failed"
              ? "degraded"
              : "ready",
        detail: !google
          ? "Not connected."
          : google.lastSyncedAt
            ? `Last synchronized ${google.lastSyncedAt.toISOString()}.`
            : "Connected but never synchronized.",
        action: !google
          ? "Optional: connect Google Business Profile from Marketing integrations."
          : google.lastError
            ? "Run a manual synchronization and review the safe error shown in integrations."
            : null,
      },
    ],
  };
}

export const loadCachedOperationalReadiness = unstable_cache(
  loadOperationalReadiness,
  ["operational-readiness-v1"],
  { revalidate: 60 },
);
