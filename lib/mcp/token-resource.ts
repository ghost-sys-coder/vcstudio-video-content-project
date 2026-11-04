import { z } from "zod";
import { McpError } from "./errors";
/** Signature, issuer and expiry are verified by Clerk before inspecting claims. */
export function assertMcpTokenResource(
  verifiedToken: string,
  resource: string,
) {
  try {
    const payload = z
      .object({ aud: z.union([z.string(), z.array(z.string())]) })
      .parse(
        JSON.parse(
          Buffer.from(verifiedToken.split(".")[1] ?? "", "base64url").toString(
            "utf8",
          ),
        ),
      );
    const audiences =
      typeof payload.aud === "string" ? [payload.aud] : payload.aud;
    if (audiences.includes(resource)) return;
  } catch {
    /* Unbound tokens cannot establish the resource audience. */
  }
  throw new McpError(
    "unauthenticated",
    "The OAuth access token must be issued for this VCStudio MCP resource. Configure Clerk's resource audience before enabling the connection.",
  );
}
