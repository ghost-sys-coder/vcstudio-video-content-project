import "server-only";
import { incrementRateLimitCount } from "@/db/repositories/rate-limit.repository";
import { resolveRateWindowStart } from "@/lib/rate-limit/rate-limit";
import type { McpContext } from "./context";
import { requireMcp } from "./errors";
export async function enforceMcpRateLimit(
  context: McpContext,
  kind: "read" | "write" | "import" | "upload_chunk",
) {
  const window = kind === "import" ? 3600 : 60;
  const max =
    kind === "read"
      ? 120
      : kind === "write"
        ? 30
        : kind === "upload_chunk"
          ? 240
          : 10;
  const count = await incrementRateLimitCount({
    scopeKey: `mcp:${context.workspaceId}:${context.principal.userId}:${context.connection.id}:${kind}`,
    windowStart: resolveRateWindowStart(new Date(), window),
  });
  requireMcp(
    count <= max,
    "rate_limited",
    "This connection is sending requests too quickly. Try again later.",
  );
}
