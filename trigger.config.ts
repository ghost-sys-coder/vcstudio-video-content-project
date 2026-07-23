import { defineConfig } from "@trigger.dev/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  additionalFiles,
  aptGet,
  ffmpeg,
  syncEnvVars,
} from "@trigger.dev/build/extensions/core";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import type { Plugin } from "esbuild";

// System libraries the headless Chromium that Remotion drives needs on the
// Debian-based deploy image. Adjust for the current base image if the render
// worker fails to launch a browser.
const REMOTION_CHROMIUM_PACKAGES = [
  "libnss3",
  "libdbus-1-3",
  "libatk1.0-0",
  "libgbm-dev",
  "libasound2",
  "libxrandr2",
  "libxkbcommon-dev",
  "libxfixes3",
  "libxcomposite1",
  "libxdamage1",
  "libatk-bridge2.0-0",
  "libpango-1.0-0",
  "libcairo2",
  "libcups2",
];

// `server-only`/`client-only` only exist to guard the React Server/Client
// boundary; in the Trigger.dev Node worker they must be inert. We stub them to
// empty modules via esbuild rather than relying on the `react-server` export
// condition, because that condition also makes Remotion's core throw its RSC
// guard ("Remotion requires React.createContext, but it is undefined") when the
// render worker loads `@remotion/renderer`/`@remotion/bundler` at runtime.
const stubServerOnlyBoundary: Plugin = {
  name: "stub-server-only-boundary",
  setup(build) {
    build.onResolve({ filter: /^(server-only|client-only)$/ }, (args) => ({
      path: args.path,
      namespace: "trigger-empty-module",
    }));
    build.onLoad({ filter: /.*/, namespace: "trigger-empty-module" }, () => ({
      contents: "export {};",
      loader: "js",
    }));
  },
};

// Env vars the deploy tooling owns — never sync these into the runtime env.
const DEPLOY_CONTROL_ENV_KEYS = new Set([
  "TRIGGER_SECRET_KEY",
  "TRIGGER_PROJECT_REF",
  "TRIGGER_API_URL",
  "NODE_ENV",
]);

/**
 * Reads the worker's env file so it can be pushed to the Trigger.dev environment
 * on deploy. This is what keeps the deployed worker's variables in parity with
 * the repo's source of truth — the outage that motivated it was a required
 * variable (`TIKTOK_API_CLIENT_*`) that existed in this file but was never set
 * in the Trigger.dev dashboard, so every publish crashed at env validation.
 *
 * Only additive/updating — it never deletes dashboard-managed vars. Returns an
 * empty set if the (gitignored) file is absent, e.g. in CI.
 */
function readWorkerEnvFile(): Record<string, string> {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.trigger.dev"), "utf8");
    const result: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      if (DEPLOY_CONTROL_ENV_KEYS.has(key)) continue;
      let value = trimmed.slice(separator + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      )
        value = value.slice(1, -1);
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  legacyDevProcessCwdBehaviour: false,
  build: {
    // Remotion's renderer and bundler (the bundler pulls in @rspack/core) ship
    // native binaries and cannot be bundled — they must be installed in the
    // deploy image so npm resolves the correct platform binding on the Linux
    // build machine instead of the host's (e.g. win32) binding. See
    // https://trigger.dev/docs/config/config-file#external.
    external: ["@remotion/renderer", "@remotion/bundler", "remotion"],
    extensions: [
      // Provisions ffmpeg/ffprobe for Phase 7 audio inspection and Phase 9
      // video muxing.
      ffmpeg(),
      // Phase 9: the Remotion server renderer bundles the composition at run
      // time, so the raw source tree must ship with the worker, and headless
      // Chromium needs its system libraries installed.
      additionalFiles({
        files: [
          "remotion/**",
          "lib/**",
          "db/**",
          "tsconfig.json",
          "next.config.ts",
        ],
      }),
      aptGet({ packages: REMOTION_CHROMIUM_PACKAGES }),
      esbuildPlugin(stubServerOnlyBoundary),
      // Push the worker env file to the deployed environment so a variable can
      // never exist in the repo but be missing from the running worker. Skipped
      // for `dev`, which reads the local environment directly.
      syncEnvVars((ctx) =>
        ctx.environment === "dev" ? {} : readWorkerEnvFile(),
      ),
    ],
  },
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
});
