import type { Scene, SceneVersion } from "@/db/schema";
import { SceneCard } from "@/components/scenes/SceneCard";

export function SceneList({
  rows,
  canEdit,
}: {
  rows: Array<{ scene: Scene; version: SceneVersion }>;
  canEdit: boolean;
}) {
  return rows.length ? (
    <div className="space-y-5">
      {rows.map(({ scene, version }) => (
        <SceneCard
          canEdit={canEdit}
          key={scene.id}
          scene={scene}
          version={version}
        />
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <h2 className="font-semibold">No scenes yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Approve a script version, review the cost, and start scene analysis.
      </p>
    </div>
  );
}
