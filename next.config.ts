import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Remotion server renderer and bundler run only inside the Trigger.dev
  // rendering worker (see trigger/video-render.ts). They ship native binaries
  // and a headless Chromium and must never be traced into the Next.js server
  // bundle; keeping them external guarantees the web runtime never loads them.
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
};

export default nextConfig;
