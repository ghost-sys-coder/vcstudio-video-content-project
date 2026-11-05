import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
await import("./build-mcp-widget.mjs");
const out = path.resolve(".next/mcp-ui-tests");
await mkdir(out, { recursive: true });
const css =
  (await readFile("public/mcp/review.html", "utf8")).match(
    /<style>([\s\S]*?)<\/style>/,
  )?.[1] ?? "";
for (const [name, entry] of [
  ["harness", "e2e/mcp/fixtures/entry.tsx"],
  ["host", "e2e/mcp/fixtures/host.ts"],
  ["waitlist", "e2e/mcp/fixtures/waitlist-entry.tsx"],
  ["post-composer", "e2e/mcp/fixtures/post-composer-entry.tsx"],
  ["operations", "e2e/mcp/fixtures/operations-entry.tsx"],
  ["application-error", "e2e/mcp/fixtures/application-error-entry.tsx"],
  ["queue", "e2e/mcp/fixtures/queue-entry.tsx"],
]) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      "next/link": path.resolve("e2e/mcp/fixtures/MockNextLink.tsx"),
      ...(name === "queue"
        ? {
            "next/link": path.resolve("e2e/mcp/fixtures/MockQueueLink.tsx"),
            "next/navigation": path.resolve(
              "e2e/mcp/fixtures/MockQueueNavigation.ts",
            ),
          }
        : {}),
      ...(name === "operations" || name === "application-error"
        ? {
            "next/navigation": path.resolve(
              "e2e/mcp/fixtures/MockOperationsNavigation.ts",
            ),
            "@/app/(authenticated)/app/usage/actions": path.resolve(
              "e2e/mcp/fixtures/MockOperationsActions.ts",
            ),
          }
        : {}),
      ...(name === "post-composer"
        ? {
            "next/link": path.resolve("e2e/mcp/fixtures/MockNextLink.tsx"),
            "next/navigation": path.resolve(
              "e2e/mcp/fixtures/MockNavigation.ts",
            ),
            "@/app/(authenticated)/app/social/posts/actions": path.resolve(
              "e2e/mcp/fixtures/MockSocialActions.ts",
            ),
            "@/app/(authenticated)/app/social/library-actions": path.resolve(
              "e2e/mcp/fixtures/MockSocialActions.ts",
            ),
          }
        : {}),
      ...(name === "waitlist"
        ? {
            "@clerk/nextjs": path.resolve("e2e/mcp/fixtures/MockClerk.ts"),
            "next/link": path.resolve("e2e/mcp/fixtures/MockNextLink.tsx"),
          }
        : {}),
      "@/app/(authenticated)/app/settings/mcp/actions": path.resolve(
        "e2e/mcp/fixtures/actions.ts",
      ),
      "@/app/(authenticated)/app/mcp/operations/[operationId]/actions":
        path.resolve("e2e/mcp/fixtures/actions.ts"),
    },
  });
  await writeFile(
    path.join(out, `${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0;padding:16px;min-width:0}</style></head><body><div id="root"></div><script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
  );
}
const server = createServer(async (req, res) => {
  const filename = new URL(req.url, "http://localhost").pathname;
  if (filename === "/__test_shutdown" && req.method === "POST") {
    res.writeHead(204).end();
    setImmediate(() => {
      server.closeAllConnections();
      server.close();
    });
    return;
  }
  const allowed = {
    "/host.html": path.join(out, "host.html"),
    "/harness.html": path.join(out, "harness.html"),
    "/review.html": path.resolve("public/mcp/review.html"),
    "/waitlist.html": path.join(out, "waitlist.html"),
    "/post-composer.html": path.join(out, "post-composer.html"),
    "/operations.html": path.join(out, "operations.html"),
    "/application-error.html": path.join(out, "application-error.html"),
    "/app/queue": path.join(out, "queue.html"),
  };
  if (!allowed[filename]) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(await readFile(allowed[filename]));
});
server.listen(38173, "127.0.0.1");
