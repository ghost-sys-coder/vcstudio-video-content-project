import "server-only";
import { z } from "zod";
import { getMcpEnvironment } from "@/lib/env/server";
export function mcpBaseUrl() {
  const url = new URL(getMcpEnvironment().APP_BASE_URL);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("MCP_REQUIRES_HTTPS");
  return url.origin;
}
export function clerkOAuthIssuer() {
  const encoded = /^pk_(?:test|live)_(.+)$/.exec(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  )?.[1];
  if (!encoded) throw new Error("CLERK_PUBLISHABLE_KEY_REQUIRED");
  const host = Buffer.from(encoded, "base64")
    .toString("utf8")
    .replace(/\$$/, "");
  const url = z.url().parse(`https://${host}`);
  if (new URL(url).hostname !== host) throw new Error("INVALID_CLERK_ISSUER");
  return new URL(url).origin;
}
