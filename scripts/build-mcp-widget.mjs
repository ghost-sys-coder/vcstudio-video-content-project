import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
const widgets = [
  ["review", "lib/mcp/widget-entry.tsx", "VCStudio publication review"],
  ["upload", "lib/mcp/upload-widget-entry.tsx", "VCStudio media upload"],
];
const [bundles, styles] = await Promise.all([
  Promise.all(
    widgets.map(([, entry]) =>
      build({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2022",
        define: { "process.env.NODE_ENV": '"production"' },
        tsconfig: "tsconfig.json",
      }),
    ),
  ),
  postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), {
    from: "app/globals.css",
  }),
]);
await mkdir("public/mcp", { recursive: true });
for (let index = 0; index < widgets.length; index++) {
  const [name, , title] = widgets[index];
  const js = bundles[index].outputFiles[0].text.replace(
    /<\/script/gi,
    "<\\/script",
  );
  await writeFile(
    `public/mcp/${name}.html`,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${styles.css}</style><style>body{padding:16px;margin:0;min-width:0}#root{max-width:100%;overflow-wrap:anywhere}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
  );
}
console.log("Built the standalone MCP review and upload resources.");
