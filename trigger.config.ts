import { defineConfig } from "@trigger.dev/sdk";
import {
  additionalFiles,
  aptGet,
  ffmpeg,
} from "@trigger.dev/build/extensions/core";

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

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  legacyDevProcessCwdBehaviour: false,
  build: {
    conditions: ["react-server"],
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
