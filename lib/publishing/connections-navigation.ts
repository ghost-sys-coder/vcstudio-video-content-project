import { connectionOAuthQuerySchema } from "@/lib/schemas/connection-oauth";

export const WORKSPACE_CONNECTIONS_PATH = "/app/social/accounts";

/** Preserve older OAuth return links without forwarding arbitrary query data. */
export function getLegacyConnectionsRedirect(
  searchParams: Record<string, unknown>,
): string | null {
  const statuses = connectionOAuthQuerySchema.parse(searchParams);
  const query = new URLSearchParams();
  for (const [platform, status] of Object.entries(statuses)) {
    if (status) query.set(platform, status);
  }
  return query.size > 0 ? `${WORKSPACE_CONNECTIONS_PATH}?${query}` : null;
}
