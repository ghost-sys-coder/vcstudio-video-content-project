import "server-only";
import { wait } from "@trigger.dev/sdk";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { OpenAiImageGenerationProvider } from "@/lib/openai/openai-image-generation-provider";
import { ElevenLabsImageProvider } from "./image-provider";
import {
  saveImageProviderHandle,
  type ImageProviderOwner,
} from "@/db/commands/image-provider-handle";

export function createImageProvider(
  model: string,
  owner: ImageProviderOwner,
  resumeJobId?: string,
) {
  if (model.startsWith("elevenlabs/"))
    return new ElevenLabsImageProvider(
      (id) => saveImageProviderHandle(owner, id),
      async () => {
        await wait.for({ seconds: 5 });
      },
      resumeJobId,
    );
  const env = getSceneImageEnvironment();
  return new OpenAiImageGenerationProvider({
    apiKey: env.OPENAI_API_KEY,
    timeoutMilliseconds: env.OPENAI_REQUEST_TIMEOUT_SECONDS * 1000,
  });
}
