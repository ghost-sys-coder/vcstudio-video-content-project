import Link from "next/link";
import { PencilLineIcon } from "lucide-react";
import {
  sceneWorkspaceSearch,
  type SceneWorkspaceState,
} from "@/lib/production/scene-workspace-state";

/**
 * Opens one scene from the grid in the detail view.
 *
 * It carries the whole shared state, not just the scene number, so moving from
 * the grid into a scene and back again returns to the same filtered grid rather
 * than resetting it.
 */
export function StoryboardSceneLink({
  projectId,
  sceneNumber,
  workspaceState,
}: {
  projectId: string;
  sceneNumber: number;
  workspaceState: SceneWorkspaceState;
}) {
  const search = sceneWorkspaceSearch({ ...workspaceState, sceneNumber });

  return (
    <Link
      className="inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      href={`/app/projects/${projectId}/scenes${search}`}
    >
      <PencilLineIcon aria-hidden className="size-3" />
      Open scene {sceneNumber}
    </Link>
  );
}
