import { lookup, type LookupAddress, type LookupOptions } from "node:dns";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, request } from "undici";
import { McpError } from "./errors";

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function safeSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new McpError("invalid_source", "Provide a downloadable HTTPS file.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new McpError(
      "invalid_source",
      "Only public HTTPS download locations are accepted.",
    );
  url.hash = "";
  return url;
}
// Validate *and use* the same DNS result; validating before a normal fetch would
// leave a DNS-rebinding gap. All candidate addresses must be public.
function publicLookup(
  hostname: string,
  options: LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
) {
  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (
      error ||
      !addresses.length ||
      addresses.some((a) => !isPublicAddress(a.address))
    ) {
      callback(
        Object.assign(new Error("Public network address required."), {
          code: "EACCES",
        }),
        "",
      );
      return;
    }
    const first = addresses[0];
    if (options.all) callback(null, addresses);
    else callback(null, first.address, first.family);
  });
}
export async function withPublicDownload<T>(
  source: string,
  consume: (response: {
    body: AsyncIterable<Uint8Array>;
    contentType: string;
    contentLength: number | null;
    sourceHost: string;
  }) => Promise<T>,
): Promise<T> {
  const agent = new Agent({
    connect: { lookup: publicLookup, timeout: 10_000 },
  });
  try {
    let url = safeSourceUrl(source);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await request(url, {
        dispatcher: agent,
        signal: AbortSignal.timeout(180_000),
        headersTimeout: 15_000,
        bodyTimeout: 30_000,
        headers: {
          accept: "image/*, video/*;q=0.9",
          "accept-encoding": "identity",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.body.destroy();
        const location = response.headers.location;
        if (typeof location !== "string" || redirects === 3) break;
        url = safeSourceUrl(new URL(location, url).href);
        continue;
      }
      if (response.statusCode !== 200) {
        response.body.destroy();
        throw new McpError(
          "source_unavailable",
          "The download is unavailable or expired. Request a fresh file link or use upload.",
        );
      }
      const type = response.headers["content-type"];
      const length = Number(response.headers["content-length"]);
      try {
        return await consume({
          body: response.body,
          contentType:
            typeof type === "string"
              ? type.split(";")[0].trim().toLowerCase()
              : "",
          contentLength:
            Number.isSafeInteger(length) && length > 0 ? length : null,
          sourceHost: url.hostname,
        });
      } finally {
        response.body.destroy();
      }
    }
    throw new McpError(
      "invalid_source",
      "The download redirected too many times.",
    );
  } finally {
    await agent.close();
  }
}
