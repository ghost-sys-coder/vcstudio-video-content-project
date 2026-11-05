import "server-only";
import { getVideoGenerationEnvironment } from "@/lib/env/server";
import { GoogleVideoProvider } from "./providers/google-video-provider";
import { RunwayVideoProvider } from "./providers/runway-video-provider";
import { LumaVideoProvider } from "./providers/luma-video-provider";
import { VideoProviderError, type VideoProvider } from "./video-provider";
export function createVideoProvider(provider: string): VideoProvider {
  const environment = getVideoGenerationEnvironment();
  if (
    provider === "google_gemini" &&
    environment.GOOGLE_AI_VIDEO_GENERATION_API_KEY
  )
    return new GoogleVideoProvider(
      environment.GOOGLE_AI_VIDEO_GENERATION_API_KEY,
    );
  if (provider === "runway" && environment.RUNWAYML_API_SECRET)
    return new RunwayVideoProvider(environment.RUNWAYML_API_SECRET);
  if (provider === "luma" && environment.LUMA_AGENTS_API_KEY)
    return new LumaVideoProvider(environment.LUMA_AGENTS_API_KEY);
  throw new VideoProviderError("provider_not_configured", true);
}
