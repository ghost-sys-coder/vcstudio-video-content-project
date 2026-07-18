import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  legacyDevProcessCwdBehaviour: false,
  build: {
    conditions: ["react-server"],
    // Provisions ffmpeg/ffprobe in the deployed image so Phase 7 audio
    // duration inspection works in production.
    extensions: [ffmpeg()],
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
