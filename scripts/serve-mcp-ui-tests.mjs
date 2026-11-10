import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
await import("./build-mcp-widget.mjs");
const out = path.resolve(".next/mcp-ui-tests");
await mkdir(out, { recursive: true });
const css =
  (await readFile("public/mcp/review.html", "utf8")).match(
    /<style>([\s\S]*?)<\/style>/,
  )?.[1] ?? "";
const applicationCss = (
  await postcss([tailwindcss()]).process(
    await readFile("app/globals.css", "utf8"),
    {
      from: path.resolve("app/globals.css"),
    },
  )
).css;
for (const [name, entry] of [
  ["harness", "e2e/mcp/fixtures/entry.tsx"],
  ["host", "e2e/mcp/fixtures/host.ts"],
  ["upload-host", "e2e/mcp/fixtures/upload-host.ts"],
  ["waitlist", "e2e/mcp/fixtures/waitlist-entry.tsx"],
  ["post-composer", "e2e/mcp/fixtures/post-composer-entry.tsx"],
  ["operations", "e2e/mcp/fixtures/operations-entry.tsx"],
  ["application-error", "e2e/mcp/fixtures/application-error-entry.tsx"],
  ["queue", "e2e/mcp/fixtures/queue-entry.tsx"],
  ["video", "e2e/mcp/fixtures/video-entry.tsx"],
  ["tiktok-connect", "e2e/mcp/fixtures/tiktok-connect-entry.tsx"],
  ["project-creation", "e2e/mcp/fixtures/project-creation-entry.tsx"],
  ["facebook-selection", "e2e/mcp/fixtures/facebook-selection-entry.tsx"],
  ["video-media", "e2e/mcp/fixtures/video-media-entry.tsx"],
  ["media-upload", "e2e/mcp/fixtures/media-upload-entry.tsx"],
  ["media-library", "e2e/mcp/fixtures/media-library-entry.tsx"],
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
      ...(name === "media-library"
        ? {
            "@/app/(authenticated)/app/social/inspection-actions": path.resolve(
              "e2e/mcp/fixtures/MockLibraryInspectionActions.ts",
            ),
            "@/app/(authenticated)/app/social/actions": path.resolve(
              "e2e/mcp/fixtures/MockLibraryInspectionActions.ts",
            ),
            "@/app/(authenticated)/app/social/video-thumbnail-actions":
              path.resolve("e2e/mcp/fixtures/MockVideoThumbnailActions.ts"),
          }
        : {}),
      ...(name === "video-media"
        ? {
            "@/app/(authenticated)/app/social/video-thumbnail-actions":
              path.resolve("e2e/mcp/fixtures/MockVideoThumbnailActions.ts"),
          }
        : {}),
      ...(name === "facebook-selection"
        ? {
            "next/navigation": path.resolve(
              "e2e/mcp/fixtures/MockFacebookNavigation.ts",
            ),
          }
        : {}),
      ...(name === "project-creation"
        ? {
            "@/app/(authenticated)/app/projects/actions": path.resolve(
              "e2e/mcp/fixtures/MockProjectActions.ts",
            ),
          }
        : {}),
      ...(name === "tiktok-connect"
        ? {
            "@/app/(authenticated)/app/social/accounts/tiktok-actions":
              path.resolve("e2e/mcp/fixtures/MockTikTokActions.ts"),
          }
        : {}),
      ...(name === "video"
        ? {
            "next/navigation": path.resolve(
              "e2e/mcp/fixtures/MockOperationsNavigation.ts",
            ),
            "@/app/(authenticated)/app/video/actions": path.resolve(
              "e2e/mcp/fixtures/MockVideoActions.ts",
            ),
            "@/app/(authenticated)/app/social/library-actions": path.resolve(
              "e2e/mcp/fixtures/MockVideoActions.ts",
            ),
          }
        : {}),
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
      ...(name === "post-composer" || name === "media-upload"
        ? {
            "@/lib/media/read-video-duration.client": path.resolve(
              "e2e/mcp/fixtures/MockVideoDuration.ts",
            ),
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
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${name === "post-composer" || name === "tiktok-connect" || name === "project-creation" || name === "facebook-selection" || name === "video-media" || name === "media-upload" || name === "media-library" ? applicationCss : css}</style><style>body{margin:0;padding:16px;min-width:0}</style></head><body><div id="root"></div><script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
  );
}
const server = createServer(async (req, res) => {
  const filename = new URL(req.url, "http://localhost").pathname;
  if (filename === "/test-media-storage" && req.method === "PUT") {
    req.resume();
    req.on("end", () => res.writeHead(200).end());
    return;
  }
  if (filename === "/test-facebook-connected") {
    res
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end("<!doctype html><h1>Facebook Page connected</h1>");
    return;
  }
  if (filename === "/test-tiktok-authorization") {
    res
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end("<!doctype html><h1>TikTok authorization</h1>");
    return;
  }
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
    "/upload-host.html": path.join(out, "upload-host.html"),
    "/upload.html": path.resolve("public/mcp/upload.html"),
    "/harness.html": path.join(out, "harness.html"),
    "/review.html": path.resolve("public/mcp/review.html"),
    "/generation.html": path.resolve("public/mcp/generation.html"),
    "/waitlist.html": path.join(out, "waitlist.html"),
    "/post-composer.html": path.join(out, "post-composer.html"),
    "/operations.html": path.join(out, "operations.html"),
    "/application-error.html": path.join(out, "application-error.html"),
    "/app/queue": path.join(out, "queue.html"),
    "/video.html": path.join(out, "video.html"),
    "/tiktok-connect.html": path.join(out, "tiktok-connect.html"),
    "/project-creation.html": path.join(out, "project-creation.html"),
    "/facebook-selection.html": path.join(out, "facebook-selection.html"),
    "/video-media.html": path.join(out, "video-media.html"),
    "/media-upload.html": path.join(out, "media-upload.html"),
    "/media-library.html": path.join(out, "media-library.html"),
  };
  if (!allowed[filename]) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(await readFile(allowed[filename]));
});
server.listen(38173, "127.0.0.1");
