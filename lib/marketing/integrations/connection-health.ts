import type { PlatformConnectionSummary } from "@/db/repositories/publishing.repository";

export type MarketingConnectionHealth = "active" | "expired" | "revoked";

export function resolveMarketingConnectionHealth(
  connection: Pick<
    PlatformConnectionSummary,
    "status" | "accessTokenExpiresAt"
  >,
  now: Date,
): MarketingConnectionHealth {
  if (connection.status !== "active") return connection.status;
  if (
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() <= now.getTime()
  )
    return "expired";
  return "active";
}
