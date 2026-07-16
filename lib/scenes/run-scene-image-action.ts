import type { SceneImageActionResult } from "@/lib/scenes/scene-image-view";

export async function runSceneImageAction(
  action: () => Promise<SceneImageActionResult>,
  fallbackMessage: string,
): Promise<SceneImageActionResult> {
  try {
    return await action();
  } catch {
    return { success: false, error: fallbackMessage };
  }
}
