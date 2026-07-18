import { registerRoot } from "remotion";
import { RemotionRoot } from "@/remotion/RemotionRoot";

// Entry point bundled by @remotion/bundler in the render worker. It is
// referenced by absolute path and is never imported by the Next.js app.
registerRoot(RemotionRoot);
